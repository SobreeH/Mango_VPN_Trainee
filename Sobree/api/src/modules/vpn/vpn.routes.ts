import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DeviceStatus,
  PolicyAction as PrismaPolicyAction,
  PolicyProtocol as PrismaPolicyProtocol,
  RoleName as PrismaRoleName,
  SessionStatus,
  VpnProviderType as PrismaVpnProviderType,
  type PrismaClient,
} from '@prisma/client';
import {
  PolicyAction,
  PolicyProtocol,
  RoleName,
  VpnProviderType,
  type AgentVersionListResponse,
  type ConnectTicketRequest,
  type ConnectTicketResponse,
  type DaemonPolicyRule,
  type ProviderTunnelConfig,
  type VpnConnectRequest,
  type VpnConnectResponse,
  type VpnDisconnectRequest,
  type VpnDisconnectResponse,
  type VpnGatewayListResponse,
} from '@mango/shared';
import {
  AgentVersionError,
  assertAgentVersionAllowed,
  toAgentVersionDto,
  toGatewayDto,
} from '@mango/rain-admin';
import type { ApiConfig } from '../../config.js';
import type { VpnDaemonClient } from '../../lib/vpn-daemon.js';
import { createAuthenticateHook } from '../../middleware/auth.js';

const CONNECT_TICKET_TTL_SECONDS = 60;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PEER_IDENTITY_REGEX = /^[A-Za-z0-9._:-]{3,128}$/;

export interface VpnRoutesDeps {
  config: ApiConfig;
  prisma: PrismaClient;
  vpnDaemon: VpnDaemonClient;
}

class HttpRouteError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
  ) {
    super(message);
  }
}

function isValidWireGuardPublicKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  const decoded = Buffer.from(trimmed, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === trimmed;
}

function toSharedRole(role: PrismaRoleName): RoleName {
  switch (role) {
    case PrismaRoleName.ADMIN:
      return RoleName.ADMIN;
    case PrismaRoleName.STAFF:
      return RoleName.STAFF;
    case PrismaRoleName.CLIENT:
    default:
      return RoleName.CLIENT;
  }
}

function defaultSubnetForProvider(provider: VpnProviderType): string {
  switch (provider) {
    case VpnProviderType.FORTINET:
      return '10.40.0.0/24';
    case VpnProviderType.CISCO:
      return '10.50.0.0/24';
    case VpnProviderType.WIREGUARD:
    default:
      return '10.13.13.0/24';
  }
}

function defaultEndpointForProvider(provider: VpnProviderType, wgFallback: string): string {
  switch (provider) {
    case VpnProviderType.FORTINET:
      return process.env.FORTIGATE_VPN_ENDPOINT?.trim() || 'fortigate.mango.internal:443';
    case VpnProviderType.CISCO:
      return process.env.CISCO_VPN_ENDPOINT?.trim() || 'cisco.mango.internal:443';
    case VpnProviderType.WIREGUARD:
    default:
      return wgFallback;
  }
}

function allocateFreeIpFromCidr(subnetCidr: string, usedIps: Set<string>): string | null {
  const parts = subnetCidr.trim().split('/');
  if (parts.length !== 2) return null;
  const octets = parts[0]!.split('.').map((part) => Number.parseInt(part, 10));
  const prefix = Number.parseInt(parts[1]!, 10);
  if (
    octets.length !== 4 ||
    octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255) ||
    !Number.isInteger(prefix) ||
    prefix < 8 ||
    prefix > 30
  ) {
    return null;
  }

  const baseInt =
    (((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0);
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  const networkInt = (baseInt & mask) >>> 0;
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0;

  const firstHost = networkInt + 2;
  const lastHost = Math.min(broadcastInt - 1, firstHost + 4096);
  for (let hostInt = firstHost; hostInt <= lastHost; hostInt += 1) {
    const candidate = [
      (hostInt >>> 24) & 0xff,
      (hostInt >>> 16) & 0xff,
      (hostInt >>> 8) & 0xff,
      hostInt & 0xff,
    ].join('.');
    if (!usedIps.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Registers VPN control-plane endpoints (gateways discovery, ticket issuance, connect, disconnect).
 */
export async function registerVpnRoutes(
  app: FastifyInstance,
  { config, prisma, vpnDaemon }: VpnRoutesDeps,
): Promise<void> {
  const authenticate = createAuthenticateHook(config, prisma);

  app.get(
    '/api/vpn/gateways',
    { preHandler: authenticate },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const rows = await prisma.vpnGateway.findMany({
        where: {
          isEnabled: true,
          allowedRoles: { has: authUser.role as PrismaRoleName },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      });

      const response: VpnGatewayListResponse = {
        items: rows.map(toGatewayDto),
      };
      return reply.status(200).send(response);
    },
  );

  app.get(
    '/api/vpn/agent-versions',
    { preHandler: authenticate },
    async (request, reply) => {
      if (!request.authUser) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const rows = await prisma.agentVersion.findMany({
        where: { isActive: true },
        orderBy: [{ releasedAt: 'desc' }, { version: 'desc' }],
      });

      const response: AgentVersionListResponse = {
        items: rows.map(toAgentVersionDto),
      };
      return reply.status(200).send(response);
    },
  );

  app.post<{ Body: Partial<ConnectTicketRequest> | undefined }>(
    '/api/vpn/ticket',
    { preHandler: authenticate },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const requestedGatewayId =
        typeof request.body?.gatewayId === 'string' ? request.body.gatewayId.trim() : '';

      let gateway: {
        id: string;
        name: string;
        providerType: PrismaVpnProviderType;
        allowedRoles: PrismaRoleName[];
        isEnabled: boolean;
      } | null = null;

      if (requestedGatewayId) {
        if (!UUID_REGEX.test(requestedGatewayId)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid gatewayId',
          });
        }

        gateway = await prisma.vpnGateway.findUnique({
          where: { id: requestedGatewayId },
          select: {
            id: true,
            name: true,
            providerType: true,
            allowedRoles: true,
            isEnabled: true,
          },
        });
        if (!gateway) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'VPN gateway not found',
          });
        }
        if (!gateway.isEnabled) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Selected VPN gateway is disabled',
          });
        }
        if (!gateway.allowedRoles.includes(authUser.role as PrismaRoleName)) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: 'Your role is not permitted to use the selected VPN gateway',
          });
        }
      }

      const rawTicket = crypto.randomBytes(32).toString('base64url');
      const ticketHash = crypto.createHash('sha256').update(rawTicket).digest('hex');
      const expiresAt = new Date(Date.now() + CONNECT_TICKET_TTL_SECONDS * 1000);

      await prisma.$transaction(async (tx) => {
        const created = await tx.connectTicket.create({
          data: {
            userId: authUser.id,
            gatewayId: gateway?.id ?? null,
            ticketHash,
            expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: authUser.id,
            action: 'VPN_TICKET_ISSUED',
            targetType: 'ConnectTicket',
            targetId: created.id,
            ipAddress: request.ip,
            ...(gateway
              ? {
                  metadata: {
                    gatewayId: gateway.id,
                    providerType: gateway.providerType,
                  },
                }
              : {}),
          },
        });
      });

      const response: ConnectTicketResponse = {
        ticket: rawTicket,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: CONNECT_TICKET_TTL_SECONDS,
        ...(gateway
          ? {
              gatewayId: gateway.id,
              providerType: gateway.providerType as VpnProviderType,
              gatewayName: gateway.name,
            }
          : {}),
      };
      return reply.status(201).send(response);
    },
  );

  app.post<{ Body: Partial<VpnConnectRequest> }>(
    '/api/vpn/connect',
    async (request, reply) => {
      const ticket = request.body?.ticket?.trim() ?? '';
      const publicKey = request.body?.publicKey?.trim() ?? '';
      const requestedPeerIdentity = request.body?.peerIdentity?.trim() ?? '';
      const rawProviderType = request.body?.providerType?.trim().toUpperCase() ?? '';
      const requestedGatewayId = request.body?.gatewayId?.trim() ?? '';
      const deviceFingerprint = request.body?.deviceFingerprint?.trim() ?? '';
      const hostname = request.body?.hostname?.trim() ?? '';
      const agentVersion = request.body?.agentVersion?.trim() ?? '';
      const platform = request.body?.platform?.trim() || 'windows-x64';

      if (!ticket || !deviceFingerprint || !hostname || !agentVersion) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'ticket, deviceFingerprint, hostname, and agentVersion are required',
        });
      }

      let requestedProvider: VpnProviderType | null = null;
      if (rawProviderType) {
        if (!Object.values(VpnProviderType).includes(rawProviderType as VpnProviderType)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'providerType must be WIREGUARD, FORTINET, or CISCO',
          });
        }
        requestedProvider = rawProviderType as VpnProviderType;
      }

      if (requestedGatewayId && !UUID_REGEX.test(requestedGatewayId)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid gatewayId',
        });
      }

      if (requestedPeerIdentity && !PEER_IDENTITY_REGEX.test(requestedPeerIdentity)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'peerIdentity must be 3-128 characters of [A-Za-z0-9._:-]',
        });
      }

      try {
        await assertAgentVersionAllowed(prisma, agentVersion, platform);
      } catch (err) {
        if (err instanceof AgentVersionError) {
          return reply.status(err.statusCode).send({
            statusCode: err.statusCode,
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }

      const ticketHash = crypto.createHash('sha256').update(ticket).digest('hex');

      let allocation: {
        userId: string;
        username: string;
        role: RoleName;
        deviceId: string;
        sessionId: string;
        assignedIp: string;
        providerType: VpnProviderType;
        gatewayId: string | null;
        gatewayName: string | null;
        gatewayEndpoint: string | null;
        gatewayDns: string[];
        peerIdentity: string;
        previousPeer: {
          publicKey: string;
          peerIdentity: string | null;
          providerType: PrismaVpnProviderType;
          gatewayId: string | null;
        } | null;
        allowedIps: string[];
        policies: DaemonPolicyRule[];
        connectedAt: Date;
      };

      try {
        allocation = await prisma.$transaction(async (tx) => {
          // Serialize IPAM allocation & ticket redemption across concurrent connect requests
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('mango_vpn_ipam'))`;

          const ticketRecord = await tx.connectTicket.findUnique({
            where: { ticketHash },
            include: {
              user: {
                include: { role: true },
              },
              gateway: true,
            },
          });

          if (!ticketRecord) {
            throw new HttpRouteError(401, 'Unauthorized', 'Invalid connect ticket');
          }
          if (ticketRecord.redeemedAt !== null) {
            throw new HttpRouteError(401, 'Unauthorized', 'Connect ticket has already been redeemed');
          }
          const now = new Date();
          if (ticketRecord.expiresAt <= now) {
            throw new HttpRouteError(401, 'Unauthorized', 'Connect ticket has expired');
          }
          if (!ticketRecord.user.isActive) {
            throw new HttpRouteError(403, 'Forbidden', 'User account is disabled');
          }

          let gateway = ticketRecord.gateway;
          if (gateway && requestedGatewayId && gateway.id !== requestedGatewayId) {
            throw new HttpRouteError(400, 'Bad Request', 'Connect ticket is bound to a different gateway');
          }
          if (!gateway && requestedGatewayId) {
            gateway = await tx.vpnGateway.findUnique({ where: { id: requestedGatewayId } });
            if (!gateway) {
              throw new HttpRouteError(404, 'Not Found', 'VPN gateway not found');
            }
          }
          if (gateway) {
            if (!gateway.isEnabled) {
              throw new HttpRouteError(403, 'Forbidden', 'Selected VPN gateway is disabled');
            }
            if (!gateway.allowedRoles.includes(ticketRecord.user.role.name)) {
              throw new HttpRouteError(
                403,
                'Forbidden',
                'User role is not permitted to connect to this VPN gateway',
              );
            }
          }

          const effectiveProvider =
            (gateway?.providerType as VpnProviderType | undefined) ??
            requestedProvider ??
            VpnProviderType.WIREGUARD;

          if (requestedProvider && gateway && requestedProvider !== effectiveProvider) {
            throw new HttpRouteError(
              400,
              'Bad Request',
              'Requested providerType does not match bound gateway provider',
            );
          }

          let effectivePeerIdentity = '';
          if (effectiveProvider === VpnProviderType.WIREGUARD) {
            if (!publicKey) {
              throw new HttpRouteError(
                400,
                'Bad Request',
                'publicKey is required for WIREGUARD connections',
              );
            }
            if (!isValidWireGuardPublicKey(publicKey)) {
              throw new HttpRouteError(
                400,
                'Bad Request',
                'publicKey must be a valid 32-byte base64 WireGuard key',
              );
            }
            effectivePeerIdentity = publicKey;
          } else {
            effectivePeerIdentity =
              requestedPeerIdentity ||
              `${effectiveProvider.toLowerCase()}-${ticketRecord.user.username}-${crypto.randomBytes(6).toString('hex')}`;
          }

          const redeemed = await tx.connectTicket.updateMany({
            where: { id: ticketRecord.id, redeemedAt: null },
            data: { redeemedAt: now },
          });
          if (redeemed.count !== 1) {
            throw new HttpRouteError(401, 'Unauthorized', 'Connect ticket has already been redeemed');
          }

          const existingDevice = await tx.device.findUnique({
            where: { fingerprint: deviceFingerprint },
          });
          if (existingDevice?.status === DeviceStatus.REVOKED) {
            throw new HttpRouteError(403, 'Forbidden', 'Device has been revoked');
          }
          if (existingDevice && existingDevice.userId !== ticketRecord.userId) {
            throw new HttpRouteError(403, 'Forbidden', 'Device fingerprint belongs to another user');
          }

          const device = existingDevice
            ? await tx.device.update({
                where: { id: existingDevice.id },
                data: { hostname, lastSeenAt: now, status: DeviceStatus.ACTIVE },
              })
            : await tx.device.create({
                data: {
                  userId: ticketRecord.userId,
                  hostname,
                  fingerprint: deviceFingerprint,
                  status: DeviceStatus.ACTIVE,
                  lastSeenAt: now,
                },
              });

          const existingDevicePeer = await tx.vpnPeer.findFirst({
            where: {
              deviceId: device.id,
              gatewayId: gateway?.id ?? null,
              providerType: effectiveProvider as PrismaVpnProviderType,
            },
            orderBy: { createdAt: 'desc' },
          });

          const previousPeer =
            existingDevicePeer && existingDevicePeer.publicKey !== effectivePeerIdentity
              ? {
                  publicKey: existingDevicePeer.publicKey,
                  peerIdentity: existingDevicePeer.peerIdentity,
                  providerType: existingDevicePeer.providerType,
                  gatewayId: existingDevicePeer.gatewayId,
                }
              : null;

          const subnetCidr = gateway?.subnetCidr ?? defaultSubnetForProvider(effectiveProvider);

          let peer = existingDevicePeer;
          if (peer) {
            peer = await tx.vpnPeer.update({
              where: { id: peer.id },
              data: {
                publicKey: effectivePeerIdentity,
                peerIdentity: effectivePeerIdentity,
                providerType: effectiveProvider as PrismaVpnProviderType,
                gatewayId: gateway?.id ?? null,
                isActive: true,
              },
            });
          } else {
            const usedPeers = await tx.vpnPeer.findMany({
              where: gateway
                ? { gatewayId: gateway.id }
                : { gatewayId: null, providerType: effectiveProvider as PrismaVpnProviderType },
              select: { assignedIp: true },
            });
            const usedSet = new Set(usedPeers.map((p) => p.assignedIp));
            const freeIp = allocateFreeIpFromCidr(subnetCidr, usedSet);
            if (!freeIp) {
              throw new HttpRouteError(
                503,
                'Service Unavailable',
                `No VPN IP addresses available in ${subnetCidr}`,
              );
            }

            peer = await tx.vpnPeer.create({
              data: {
                userId: ticketRecord.userId,
                deviceId: device.id,
                gatewayId: gateway?.id ?? null,
                providerType: effectiveProvider as PrismaVpnProviderType,
                publicKey: effectivePeerIdentity,
                peerIdentity: effectivePeerIdentity,
                assignedIp: freeIp,
                isActive: true,
              },
            });
          }

          await tx.vpnSession.updateMany({
            where: { deviceId: device.id, status: SessionStatus.ACTIVE },
            data: { status: SessionStatus.DISCONNECTED, disconnectedAt: now },
          });

          const session = await tx.vpnSession.create({
            data: {
              userId: ticketRecord.userId,
              deviceId: device.id,
              peerId: peer.id,
              gatewayId: gateway?.id ?? null,
              providerType: effectiveProvider as PrismaVpnProviderType,
              assignedIp: peer.assignedIp,
              status: SessionStatus.ACTIVE,
              connectedAt: now,
            },
          });

          const policies = await tx.vpnPolicy.findMany({
            where: { roleId: ticketRecord.user.roleId, enabled: true },
            orderBy: { priority: 'asc' },
          });
          const allowCidrs = policies
            .filter((p) => p.action === PrismaPolicyAction.ALLOW)
            .map((p) => p.targetCidr);

          const daemonPolicies: DaemonPolicyRule[] = policies.map((p) => ({
            targetCidr: p.targetCidr,
            protocol:
              p.protocol === PrismaPolicyProtocol.TCP
                ? PolicyProtocol.TCP
                : p.protocol === PrismaPolicyProtocol.UDP
                  ? PolicyProtocol.UDP
                  : p.protocol === PrismaPolicyProtocol.ICMP
                    ? PolicyProtocol.ICMP
                    : PolicyProtocol.ANY,
            portRange: p.portRange,
            action: p.action === PrismaPolicyAction.ALLOW ? PolicyAction.ALLOW : PolicyAction.DENY,
            priority: p.priority,
          }));

          return {
            userId: ticketRecord.userId,
            username: ticketRecord.user.username,
            role: toSharedRole(ticketRecord.user.role.name),
            deviceId: device.id,
            sessionId: session.id,
            assignedIp: peer.assignedIp,
            providerType: effectiveProvider,
            gatewayId: gateway?.id ?? null,
            gatewayName: gateway?.name ?? null,
            gatewayEndpoint: gateway?.endpoint ?? null,
            gatewayDns: gateway?.dns ?? [],
            peerIdentity: effectivePeerIdentity,
            previousPeer,
            allowedIps: allowCidrs.length > 0 ? allowCidrs : [subnetCidr],
            policies: daemonPolicies,
            connectedAt: session.connectedAt,
          };
        });
      } catch (err) {
        if (err instanceof HttpRouteError) {
          return reply.status(err.statusCode).send({
            statusCode: err.statusCode,
            error: err.error,
            message: err.message,
          });
        }
        throw err;
      }

      if (allocation.previousPeer) {
        try {
          if (
            allocation.previousPeer.providerType === PrismaVpnProviderType.WIREGUARD &&
            !allocation.previousPeer.gatewayId
          ) {
            await vpnDaemon.removePeer({ publicKey: allocation.previousPeer.publicKey });
          } else {
            await vpnDaemon.removePeer({
              publicKey: allocation.previousPeer.publicKey,
              peerIdentity: allocation.previousPeer.peerIdentity ?? allocation.previousPeer.publicKey,
              providerType: allocation.previousPeer.providerType as VpnProviderType,
              ...(allocation.previousPeer.gatewayId
                ? { gatewayId: allocation.previousPeer.gatewayId }
                : {}),
            });
          }
        } catch {
          // Best-effort cleanup of rotated ephemeral peer key before adding replacement key
        }
      }

      try {
        if (
          allocation.providerType === VpnProviderType.WIREGUARD &&
          !allocation.gatewayId
        ) {
          await vpnDaemon.addPeer({
            publicKey: allocation.peerIdentity,
            assignedIp: allocation.assignedIp,
            role: allocation.role,
            policies: allocation.policies,
          });
        } else {
          await vpnDaemon.addPeer({
            publicKey: allocation.peerIdentity,
            peerIdentity: allocation.peerIdentity,
            providerType: allocation.providerType,
            ...(allocation.gatewayId ? { gatewayId: allocation.gatewayId } : {}),
            ...(allocation.gatewayEndpoint ? { gatewayEndpoint: allocation.gatewayEndpoint } : {}),
            assignedIp: allocation.assignedIp,
            role: allocation.role,
            policies: allocation.policies,
          });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'VPN daemon failed to add peer';
        await prisma.$transaction([
          prisma.vpnSession.update({
            where: { id: allocation.sessionId },
            data: { status: SessionStatus.DISCONNECTED, disconnectedAt: new Date() },
          }),
          prisma.auditLog.create({
            data: {
              actorUserId: allocation.userId,
              action: 'VPN_CONNECT_FAILED',
              targetType: 'VpnSession',
              targetId: allocation.sessionId,
              ipAddress: request.ip,
              metadata: {
                reason,
                assignedIp: allocation.assignedIp,
                providerType: allocation.providerType,
                gatewayId: allocation.gatewayId,
              },
            },
          }),
        ]);

        return reply.status(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `VPN daemon failed: ${reason}`,
        });
      }

      await prisma.auditLog.create({
        data: {
          actorUserId: allocation.userId,
          action: 'VPN_CONNECTED',
          targetType: 'VpnSession',
          targetId: allocation.sessionId,
          ipAddress: request.ip,
          metadata: {
            deviceId: allocation.deviceId,
            assignedIp: allocation.assignedIp,
            providerType: allocation.providerType,
            gatewayId: allocation.gatewayId,
            hostname,
            agentVersion,
          },
        },
      });

      const tunnelConfig: ProviderTunnelConfig =
        allocation.providerType === VpnProviderType.FORTINET
          ? {
              providerType: VpnProviderType.FORTINET,
              protocol: 'fortinet',
              username: allocation.username,
              ephemeralSecret: crypto.randomBytes(24).toString('base64url'),
            }
          : allocation.providerType === VpnProviderType.CISCO
            ? {
                providerType: VpnProviderType.CISCO,
                protocol: 'anyconnect',
                username: allocation.username,
                ephemeralSecret: crypto.randomBytes(24).toString('base64url'),
              }
            : {
                providerType: VpnProviderType.WIREGUARD,
                serverPublicKey: config.wgServerPublicKey,
              };

      const serverEndpoint =
        allocation.gatewayEndpoint ??
        defaultEndpointForProvider(allocation.providerType, config.wgServerEndpoint);

      const response: VpnConnectResponse = {
        sessionId: allocation.sessionId,
        assignedIp: allocation.assignedIp,
        serverPublicKey:
          allocation.providerType === VpnProviderType.WIREGUARD ? config.wgServerPublicKey : '',
        serverEndpoint,
        allowedIps: allocation.allowedIps,
        dns: allocation.gatewayDns.length > 0 ? allocation.gatewayDns : config.wgDns,
        connectedAt: allocation.connectedAt.toISOString(),
        providerType: allocation.providerType,
        gatewayId: allocation.gatewayId,
        gatewayName: allocation.gatewayName,
        peerIdentity: allocation.peerIdentity,
        tunnelConfig,
      };
      return reply.status(200).send(response);
    },
  );

  app.post<{ Body: Partial<VpnDisconnectRequest> }>(
    '/api/vpn/disconnect',
    async (request, reply) => {
      const sessionId = request.body?.sessionId?.trim();
      const publicKey = request.body?.publicKey?.trim();
      const peerIdentity = request.body?.peerIdentity?.trim();
      const deviceFingerprint = request.body?.deviceFingerprint?.trim();

      if (!sessionId && !publicKey && !peerIdentity && !deviceFingerprint) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'sessionId, publicKey, peerIdentity, or deviceFingerprint is required',
        });
      }

      const session = await prisma.vpnSession.findFirst({
        where: {
          status: SessionStatus.ACTIVE,
          ...(sessionId ? { id: sessionId } : {}),
          ...(publicKey ? { peer: { publicKey } } : {}),
          ...(peerIdentity
            ? { peer: { OR: [{ peerIdentity }, { publicKey: peerIdentity }] } }
            : {}),
          ...(deviceFingerprint ? { device: { fingerprint: deviceFingerprint } } : {}),
        },
        include: { peer: true, gateway: true },
        orderBy: { connectedAt: 'desc' },
      });

      if (!session) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'No active VPN session found',
        });
      }

      try {
        if (
          session.providerType === PrismaVpnProviderType.WIREGUARD &&
          !session.gatewayId
        ) {
          await vpnDaemon.removePeer({ publicKey: session.peer.publicKey });
        } else {
          await vpnDaemon.removePeer({
            publicKey: session.peer.publicKey,
            peerIdentity: session.peer.peerIdentity ?? session.peer.publicKey,
            providerType: session.providerType as VpnProviderType,
            ...(session.gatewayId ? { gatewayId: session.gatewayId } : {}),
            ...(session.gateway?.endpoint ? { gatewayEndpoint: session.gateway.endpoint } : {}),
          });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'VPN daemon failed to remove peer';
        return reply.status(502).send({
          statusCode: 502,
          error: 'Bad Gateway',
          message: `VPN daemon failed: ${reason}`,
        });
      }

      const disconnectedAt = new Date();
      await prisma.$transaction([
        prisma.vpnSession.update({
          where: { id: session.id },
          data: { status: SessionStatus.DISCONNECTED, disconnectedAt },
        }),
        prisma.auditLog.create({
          data: {
            actorUserId: session.userId,
            action: 'VPN_DISCONNECTED',
            targetType: 'VpnSession',
            targetId: session.id,
            ipAddress: request.ip,
            metadata: {
              assignedIp: session.assignedIp,
              providerType: session.providerType,
              gatewayId: session.gatewayId,
            },
          },
        }),
      ]);

      const response: VpnDisconnectResponse = {
        success: true,
        sessionId: session.id,
        disconnectedAt: disconnectedAt.toISOString(),
      };
      return reply.status(200).send(response);
    },
  );
}
