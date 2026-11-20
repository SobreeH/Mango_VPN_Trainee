import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import {
  DeviceStatus,
  SessionStatus,
  type DeviceDto,
  type DeviceListResponse,
} from '@mango/shared';
import { teardownPeersOnDaemon, UUID_REGEX, type AdminVpnDaemonClient } from './revocation.js';

function toDeviceDto(row: {
  id: string;
  userId: string;
  hostname: string;
  fingerprint: string;
  status: string;
  lastSeenAt: Date | null;
  createdAt: Date;
  user?: { username: string } | null;
}): DeviceDto {
  return {
    id: row.id,
    userId: row.userId,
    ...(row.user?.username ? { username: row.user.username } : {}),
    hostname: row.hostname,
    fingerprint: row.fingerprint,
    status: row.status as DeviceStatus,
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function registerDeviceRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  vpnDaemon?: AdminVpnDaemonClient,
) {
  app.get('/devices', async (_request, reply) => {
    const rows = await prisma.device.findMany({
      include: { user: { select: { username: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });

    const response: DeviceListResponse = {
      items: rows.map(toDeviceDto),
    };
    return reply.status(200).send(response);
  });

  const revokeHandler = async (
    request: { params: { id: string }; authUser?: { id: string }; ip: string },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  ) => {
    const { id } = request.params;
    if (!UUID_REGEX.test(id)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid device id',
      });
    }

    const device = await prisma.device.findUnique({
      where: { id },
      include: { user: { select: { username: true } } },
    });
    if (!device) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Device not found',
      });
    }

    const activePeers = await prisma.vpnPeer.findMany({
      where: {
        deviceId: id,
        OR: [
          { isActive: true },
          { sessions: { some: { status: SessionStatus.ACTIVE } } },
        ],
      },
      select: { publicKey: true },
    });

    let removedPublicKeys: string[] = [];
    try {
      removedPublicKeys = await teardownPeersOnDaemon(
        vpnDaemon,
        activePeers.map((p) => p.publicKey),
      );
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
      const revokedDevice = await tx.device.update({
        where: { id },
        data: { status: DeviceStatus.REVOKED },
        include: { user: { select: { username: true } } },
      });

      const sessionRes = await tx.vpnSession.updateMany({
        where: { deviceId: id, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.DISCONNECTED, disconnectedAt: now },
      });

      await tx.vpnPeer.updateMany({
        where: { deviceId: id, isActive: true },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: request.authUser?.id ?? null,
          action: 'DEVICE_REVOKED',
          targetType: 'Device',
          targetId: id,
          ipAddress: request.ip,
          metadata: {
            userId: device.userId,
            hostname: device.hostname,
            fingerprint: device.fingerprint,
            closedSessionsCount: sessionRes.count,
            removedPeersCount: removedPublicKeys.length,
          },
        },
      });

      return revokedDevice;
    });

    return reply.status(200).send(toDeviceDto(updated));
  };

  app.post<{ Params: { id: string } }>('/devices/:id/revoke', revokeHandler);
  app.delete<{ Params: { id: string } }>('/devices/:id', revokeHandler);
}
