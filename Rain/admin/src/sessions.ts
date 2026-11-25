import type { FastifyInstance } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  SessionStatus,
  VpnProviderType,
  type VpnSessionDto,
  type VpnSessionListResponse,
} from '@mango/shared';
import { teardownPeersOnDaemon, UUID_REGEX, type AdminVpnDaemonClient } from './revocation.js';

const VALID_SESSION_STATUSES = new Set<string>(Object.values(SessionStatus));

function toSessionDto(row: {
  id: string;
  userId: string;
  deviceId: string;
  assignedIp: string;
  status: string;
  providerType?: string;
  gatewayId?: string | null;
  connectedAt: Date;
  disconnectedAt: Date | null;
  user?: { username: string } | null;
  device?: { hostname: string } | null;
  gateway?: { name: string } | null;
  peer?: { publicKey: string; peerIdentity: string | null } | null;
}): VpnSessionDto {
  return {
    id: row.id,
    userId: row.userId,
    ...(row.user?.username ? { username: row.user.username } : {}),
    deviceId: row.deviceId,
    ...(row.device?.hostname ? { hostname: row.device.hostname } : {}),
    assignedIp: row.assignedIp,
    status: row.status as SessionStatus,
    ...(row.providerType ? { providerType: row.providerType as VpnProviderType } : {}),
    ...(row.gatewayId !== undefined ? { gatewayId: row.gatewayId } : {}),
    ...(row.gateway?.name ? { gatewayName: row.gateway.name } : {}),
    ...(row.peer ? { peerIdentity: row.peer.peerIdentity ?? row.peer.publicKey } : {}),
    connectedAt: row.connectedAt.toISOString(),
    disconnectedAt: row.disconnectedAt ? row.disconnectedAt.toISOString() : null,
  };
}

export function registerSessionRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  vpnDaemon?: AdminVpnDaemonClient,
) {
  app.get<{ Querystring: { status?: string } }>('/sessions', async (request, reply) => {
    const statusParam = request.query?.status?.trim();
    const where: Prisma.VpnSessionWhereInput = {};
    if (statusParam) {
      if (!VALID_SESSION_STATUSES.has(statusParam)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid session status filter',
        });
      }
      where.status = statusParam as SessionStatus;
    }

    const rows = await prisma.vpnSession.findMany({
      where,
      include: {
        user: { select: { username: true } },
        device: { select: { hostname: true } },
        gateway: { select: { name: true } },
        peer: { select: { publicKey: true, peerIdentity: true } },
      },
      orderBy: [{ connectedAt: 'desc' }],
    });

    const response: VpnSessionListResponse = {
      items: rows.map(toSessionDto),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Params: { id: string } }>('/sessions/:id/disconnect', async (request, reply) => {
    const { id } = request.params;
    if (!UUID_REGEX.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid session id',
      });
    }

    const session = await prisma.vpnSession.findUnique({
      where: { id },
      include: {
        peer: true,
        gateway: true,
        user: { select: { username: true } },
        device: { select: { hostname: true } },
      },
    });
    if (!session) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'VPN session not found',
      });
    }
    if (session.status !== SessionStatus.ACTIVE) {
      return reply.status(409).send({
        statusCode: 409,
        error: 'Conflict',
        message: 'VPN session is not active',
      });
    }

    try {
      await teardownPeersOnDaemon(vpnDaemon, [
        {
          publicKey: session.peer.publicKey,
          peerIdentity: session.peer.peerIdentity,
          providerType: session.providerType,
          gatewayId: session.gatewayId,
        },
      ]);
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'VPN daemon failed to remove peer';
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: `VPN daemon failed: ${reason}`,
      });
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.vpnSession.update({
        where: { id },
        data: { status: SessionStatus.DISCONNECTED, disconnectedAt: now },
        include: {
          user: { select: { username: true } },
          device: { select: { hostname: true } },
          gateway: { select: { name: true } },
          peer: { select: { publicKey: true, peerIdentity: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: request.authUser?.id ?? null,
          action: 'SESSION_FORCE_DISCONNECTED',
          targetType: 'VpnSession',
          targetId: id,
          ipAddress: request.ip,
          metadata: {
            userId: session.userId,
            deviceId: session.deviceId,
            assignedIp: session.assignedIp,
            providerType: session.providerType,
            gatewayId: session.gatewayId,
          },
        },
      });

      return closed;
    });

    return reply.status(200).send(toSessionDto(updated));
  });
}
