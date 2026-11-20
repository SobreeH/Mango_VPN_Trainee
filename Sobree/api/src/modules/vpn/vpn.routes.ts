import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DeviceStatus,
  PolicyAction as PrismaPolicyAction,
  PolicyProtocol as PrismaPolicyProtocol,
  RoleName as PrismaRoleName,
  SessionStatus,
  type PrismaClient,
} from '@prisma/client';
import {
  PolicyAction,
  PolicyProtocol,
  RoleName,
  type ConnectTicketResponse,
  type DaemonPolicyRule,
  type VpnConnectRequest,
  type VpnConnectResponse,
  type VpnDisconnectRequest,
  type VpnDisconnectResponse,
} from '@mango/shared';
import { AgentVersionError, assertAgentVersionAllowed } from '@mango/rain-admin';
import type { ApiConfig } from '../../config.js';
import type { VpnDaemonClient } from '../../lib/vpn-daemon.js';
import { createAuthenticateHook } from '../../middleware/auth.js';

const CONNECT_TICKET_TTL_SECONDS = 60;

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

/**
 * Registers VPN control-plane endpoints (ticket issuance, connect, disconnect).
 */
export async function registerVpnRoutes(
  app: FastifyInstance,
  { config, prisma, vpnDaemon }: VpnRoutesDeps,
): Promise<void> {
  const authenticate = createAuthenticateHook(config, prisma);

  app.post(
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

      const rawTicket = crypto.randomBytes(32).toString('base64url');
      const ticketHash = crypto.createHash('sha256').update(rawTicket).digest('hex');
      const expiresAt = new Date(Date.now() + CONNECT_TICKET_TTL_SECONDS * 1000);

      await prisma.$transaction(async (tx) => {
        const created = await tx.connectTicket.create({
          data: {
            userId: authUser.id,
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
          },
        });
      });

      const response: ConnectTicketResponse = {
        ticket: rawTicket,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: CONNECT_TICKET_TTL_SECONDS,
      };
      return reply.status(201).send(response);
    },
  );

  app.post<{ Body: Partial<VpnConnectRequest> }>(
    '/api/vpn/connect',
    async (request, reply) => {
      const ticket = request.body?.ticket?.trim() ?? '';
      const publicKey = request.body?.publicKey?.trim() ?? '';
      const deviceFingerprint = request.body?.deviceFingerprint?.trim() ?? '';
      const hostname = request.body?.hostname?.trim() ?? '';
      const agentVersion = request.body?.agentVersion?.trim() ?? '';

      if (!ticket || !publicKey || !deviceFingerprint || !hostname || !agentVersion) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'ticket, publicKey, deviceFingerprint, hostname, and agentVersion are required',
        });
      }

      if (!isValidWireGuardPublicKey(publicKey)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'publicKey must be a valid 32-byte base64 WireGuard key',
        });
      }

      try {
        await assertAgentVersionAllowed(prisma, agentVersion, 'windows-x64');
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
        role: RoleName;
        deviceId: string;
        sessionId: string;
        assignedIp: string;
        previousPublicKey: string | null;
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
            where: { deviceId: device.id },
            orderBy: { createdAt: 'desc' },
          });

          const previousPublicKey =
            existingDevicePeer && existingDevicePeer.publicKey !== publicKey
              ? existingDevicePeer.publicKey
              : null;

          let peer = existingDevicePeer;
          if (peer) {
            peer = await tx.vpnPeer.update({
              where: { id: peer.id },
              data: { publicKey, isActive: true },
            });
          } else {
            const usedPeers = await tx.vpnPeer.findMany({
              select: { assignedIp: true },
            });
            const usedSet = new Set(usedPeers.map((p) => p.assignedIp));
            let freeIp: string | null = null;
            for (let host = 2; host <= 254; host++) {
              const candidate = `10.13.13.${host}`;
              if (!usedSet.has(candidate)) {
                freeIp = candidate;
                break;
              }
            }
            if (!freeIp) {
              throw new HttpRouteError(
                503,
                'Service Unavailable',
                'No VPN IP addresses available in 10.13.13.0/24',
              );
            }

            peer = await tx.vpnPeer.create({
              data: {
                userId: ticketRecord.userId,
                deviceId: device.id,
                publicKey,
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
            role: toSharedRole(ticketRecord.user.role.name),
            deviceId: device.id,
            sessionId: session.id,
            assignedIp: peer.assignedIp,
            previousPublicKey,
            allowedIps: allowCidrs.length > 0 ? allowCidrs : ['10.13.13.0/24'],
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

      if (allocation.previousPublicKey) {
        try {
          await vpnDaemon.removePeer({ publicKey: allocation.previousPublicKey });
        } catch {
          // Best-effort cleanup of rotated ephemeral peer key before adding replacement key
        }
      }

      try {
        await vpnDaemon.addPeer({
          publicKey,
          assignedIp: allocation.assignedIp,
          role: allocation.role,
          policies: allocation.policies,
        });
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
              metadata: { reason, assignedIp: allocation.assignedIp },
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
            hostname,
            agentVersion,
          },
        },
      });

      const response: VpnConnectResponse = {
        sessionId: allocation.sessionId,
        assignedIp: allocation.assignedIp,
        serverPublicKey: config.wgServerPublicKey,
        serverEndpoint: config.wgServerEndpoint,
        allowedIps: allocation.allowedIps,
        dns: config.wgDns,
        connectedAt: allocation.connectedAt.toISOString(),
      };
      return reply.status(200).send(response);
    },
  );

  app.post<{ Body: Partial<VpnDisconnectRequest> }>(
    '/api/vpn/disconnect',
    async (request, reply) => {
      const sessionId = request.body?.sessionId?.trim();
      const publicKey = request.body?.publicKey?.trim();
      const deviceFingerprint = request.body?.deviceFingerprint?.trim();

      if (!sessionId && !publicKey && !deviceFingerprint) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'sessionId, publicKey, or deviceFingerprint is required',
        });
      }

      const session = await prisma.vpnSession.findFirst({
        where: {
          status: SessionStatus.ACTIVE,
          ...(sessionId ? { id: sessionId } : {}),
          ...(publicKey ? { peer: { publicKey } } : {}),
          ...(deviceFingerprint ? { device: { fingerprint: deviceFingerprint } } : {}),
        },
        include: { peer: true },
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
        await vpnDaemon.removePeer({ publicKey: session.peer.publicKey });
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
            metadata: { assignedIp: session.assignedIp },
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
