import type { PrismaClient } from '@prisma/client';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface RateLimitStatus {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Checks whether an auth rate-limit key is currently locked out.
 */
export async function checkRateLimit(
  prisma: PrismaClient,
  key: string,
  now = new Date(),
): Promise<RateLimitStatus> {
  const record = await prisma.authRateLimit.findUnique({ where: { key } });
  if (!record || !record.lockedUntil) {
    return { allowed: true };
  }
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

/**
 * Records a failed auth attempt and locks the key once MAX_ATTEMPTS is reached.
 */
export async function recordFailedAttempt(
  prisma: PrismaClient,
  key: string,
  now = new Date(),
): Promise<{ locked: boolean; retryAfterSeconds?: number }> {
  const existing = await prisma.authRateLimit.findUnique({ where: { key } });
  const windowExpired =
    !existing || now.getTime() - existing.windowStartAt.getTime() > WINDOW_MS;

  const nextAttempts = windowExpired ? 1 : existing.attempts + 1;
  const lockedUntil =
    nextAttempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : null;

  await prisma.authRateLimit.upsert({
    where: { key },
    update: {
      attempts: nextAttempts,
      windowStartAt: windowExpired ? now : existing.windowStartAt,
      lockedUntil,
    },
    create: {
      key,
      attempts: nextAttempts,
      windowStartAt: now,
      lockedUntil,
    },
  });

  if (lockedUntil) {
    return { locked: true, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { locked: false };
}

export async function clearRateLimit(prisma: PrismaClient, key: string): Promise<void> {
  await prisma.authRateLimit.deleteMany({ where: { key } });
}
