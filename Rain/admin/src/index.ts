import type { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditLogDto, AuditLogListResponse, DaemonSyncPoliciesRequest } from '@mango/shared';
import { registerAgentVersionRoutes } from './agent-versions.js';
import { registerPolicyRoutes } from './policies.js';

export * from './audit.js';
export * from './agent-versions.js';
export * from './policies.js';

export interface AdminPluginOptions {
  prisma: PrismaClient;
  authenticate: preHandlerHookHandler;
  requireAdmin: preHandlerHookHandler;
  syncPolicies?: (req: DaemonSyncPoliciesRequest) => Promise<void>;
}

interface AuditLogsQueryParams {
  page?: string;
  pageSize?: string;
  action?: string;
  targetType?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  search?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const adminPlugin: FastifyPluginAsync<AdminPluginOptions> = async (app, options) => {
  const { prisma, authenticate, requireAdmin, syncPolicies } = options;

  app.addHook('preHandler', authenticate);
  app.addHook('preHandler', requireAdmin);

  app.get<{ Querystring: AuditLogsQueryParams }>('/audit-logs', async (request, reply) => {
    const q = request.query;
    const page = Math.max(1, Number.parseInt(q.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(q.pageSize ?? '20', 10) || 20));

    const where: Prisma.AuditLogWhereInput = {};
    if (q.action?.trim()) {
      where.action = q.action.trim();
    }
    if (q.targetType?.trim()) {
      where.targetType = q.targetType.trim();
    }
    if (q.actorUserId?.trim()) {
      if (!UUID_REGEX.test(q.actorUserId.trim())) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'actorUserId must be a valid UUID',
        });
      }
      where.actorUserId = q.actorUserId.trim();
    }
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) {
        const fromDate = new Date(q.from);
        if (Number.isNaN(fromDate.getTime())) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid from date' });
        }
        where.createdAt.gte = fromDate;
      }
      if (q.to) {
        const toDate = new Date(q.to);
        if (Number.isNaN(toDate.getTime())) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid to date' });
        }
        where.createdAt.lte = toDate;
      }
    }
    if (q.search?.trim()) {
      const term = q.search.trim();
      where.OR = [
        { action: { contains: term, mode: 'insensitive' } },
        { targetType: { contains: term, mode: 'insensitive' } },
        { targetId: { contains: term, mode: 'insensitive' } },
        { ipAddress: { contains: term, mode: 'insensitive' } },
        { actor: { username: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { username: true } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: AuditLogDto[] = rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      actorUsername: row.actor?.username ?? null,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      ipAddress: row.ipAddress,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt.toISOString(),
    }));

    const response: AuditLogListResponse = {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };

    return reply.status(200).send(response);
  });

  registerAgentVersionRoutes(app, prisma);
  registerPolicyRoutes(app, prisma, syncPolicies);
};
