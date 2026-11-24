import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  RoleName,
  SessionStatus,
  type CreateUserRequest,
  type UpdateUserStatusRequest,
  type UserDto,
  type UserListResponse,
} from '@mango/shared';
import { writeAuditLog } from './audit.js';
import { teardownPeersOnDaemon, UUID_REGEX, type AdminVpnDaemonClient } from './revocation.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set<string>(Object.values(RoleName));

function toUserDto(row: {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  totpEnabled: boolean;
  createdAt: Date;
  role: { name: string };
}): UserDto {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role.name as RoleName,
    isActive: row.isActive,
    totpEnabled: row.totpEnabled,
    createdAt: row.createdAt.toISOString(),
  };
}

export function registerUserRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  vpnDaemon?: AdminVpnDaemonClient,
) {
  app.get('/users', async (_request, reply) => {
    const rows = await prisma.user.findMany({
      include: { role: { select: { name: true } } },
      orderBy: [{ createdAt: 'desc' }, { username: 'asc' }],
    });

    const response: UserListResponse = {
      items: rows.map(toUserDto),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Body: Partial<CreateUserRequest> }>('/users', async (request, reply) => {
    const username = request.body?.username?.trim() ?? '';
    const email = request.body?.email?.trim().toLowerCase() ?? '';
    const password = request.body?.password ?? '';
    const roleName = request.body?.role;
    const isActive = request.body?.isActive ?? true;

    if (!username || username.length < 3 || username.length > 64) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'username must be between 3 and 64 characters',
      });
    }
    if (!EMAIL_REGEX.test(email)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid email is required',
      });
    }
    if (typeof password !== 'string' || password.length < 12) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'password must be at least 12 characters',
      });
    }
    if (!roleName || !VALID_ROLES.has(roleName)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'role must be ADMIN, STAFF, or CLIENT',
      });
    }

    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });
    if (!role) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Role ${roleName} is not provisioned`,
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const created = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash,
          roleId: role.id,
          isActive,
        },
        include: { role: { select: { name: true } } },
      });

      await writeAuditLog(prisma, {
        actorUserId: request.authUser?.id ?? null,
        action: 'USER_CREATED',
        targetType: 'User',
        targetId: created.id,
        ipAddress: request.ip,
        metadata: {
          username: created.username,
          email: created.email,
          role: created.role.name,
          isActive: created.isActive,
        },
      });

      return reply.status(201).send(toUserDto(created));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'A user with that username or email already exists',
        });
      }
      throw err;
    }
  });

  app.patch<{ Params: { id: string }; Body: Partial<UpdateUserStatusRequest> }>(
    '/users/:id/status',
    async (request, reply) => {
      const { id } = request.params;
      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid user id',
        });
      }
      if (typeof request.body?.isActive !== 'boolean') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'isActive boolean is required',
        });
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
        include: { role: { select: { name: true } } },
      });
      if (!targetUser) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      const nextActive = request.body.isActive;
      const now = new Date();
      let removedPublicKeys: string[] = [];

      if (!nextActive) {
        const activePeers = await prisma.vpnPeer.findMany({
          where: {
            userId: id,
            OR: [
              { isActive: true },
              { sessions: { some: { status: SessionStatus.ACTIVE } } },
            ],
          },
          select: {
            publicKey: true,
            peerIdentity: true,
            providerType: true,
            gatewayId: true,
          },
        });

        try {
          removedPublicKeys = await teardownPeersOnDaemon(
            vpnDaemon,
            activePeers.map((p) => ({
              publicKey: p.publicKey,
              peerIdentity: p.peerIdentity,
              providerType: p.providerType,
              gatewayId: p.gatewayId,
            })),
          );
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'VPN daemon failed to remove peer';
          return reply.status(502).send({
            statusCode: 502,
            error: 'Bad Gateway',
            message: `VPN daemon failed: ${reason}`,
          });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: {
            isActive: nextActive,
            ...(!nextActive ? { tokenVersion: { increment: 1 } } : {}),
          },
          include: { role: { select: { name: true } } },
        });

        let revokedTokensCount = 0;
        let closedSessionsCount = 0;

        if (!nextActive) {
          const tokenRes = await tx.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: now },
          });
          revokedTokensCount = tokenRes.count;

          const sessionRes = await tx.vpnSession.updateMany({
            where: { userId: id, status: SessionStatus.ACTIVE },
            data: { status: SessionStatus.DISCONNECTED, disconnectedAt: now },
          });
          closedSessionsCount = sessionRes.count;

          await tx.vpnPeer.updateMany({
            where: { userId: id, isActive: true },
            data: { isActive: false },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: request.authUser?.id ?? null,
            action: nextActive ? 'USER_ENABLED' : 'USER_DISABLED',
            targetType: 'User',
            targetId: id,
            ipAddress: request.ip,
            metadata: {
              username: user.username,
              isActive: nextActive,
              revokedTokensCount,
              closedSessionsCount,
              removedPeersCount: removedPublicKeys.length,
            },
          },
        });

        return user;
      });

      return reply.status(200).send(toUserDto(updated));
    },
  );
}
