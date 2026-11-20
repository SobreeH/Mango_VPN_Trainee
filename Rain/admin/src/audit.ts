import type { Prisma, PrismaClient } from '@prisma/client';

export interface WriteAuditLogInput {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAuditLog(prisma: PrismaClient, input: WriteAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      ipAddress: input.ipAddress ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export type AuthAuditEventName = 'login' | 'verify-otp' | 'logout';

export interface RecordAuthAuditEventInput {
  event: AuthAuditEventName;
  actorUserId: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

const AUTH_EVENT_ACTION_MAP: Record<AuthAuditEventName, string> = {
  login: 'auth.login',
  'verify-otp': 'auth.verify_otp',
  logout: 'auth.logout',
};

export async function recordAuthAuditEvent(
  prisma: PrismaClient,
  input: RecordAuthAuditEventInput,
) {
  return writeAuditLog(prisma, {
    actorUserId: input.actorUserId,
    action: AUTH_EVENT_ACTION_MAP[input.event],
    targetType: 'AUTH',
    targetId: input.actorUserId,
    ipAddress: input.ipAddress ?? null,
    metadata: input.metadata ?? null,
  });
}
