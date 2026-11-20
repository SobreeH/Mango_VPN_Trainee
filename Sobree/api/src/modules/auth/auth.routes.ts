import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type {
  AuthTokensResponse,
  AuthUserDto,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  LogoutResponse,
  RefreshRequest,
  RoleName,
  VerifyOtpRequest,
} from '@mango/shared';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { ApiConfig } from '../../config.js';
import { createAuthenticateHook } from '../../middleware/auth.js';
import { checkRateLimit, clearRateLimit, recordFailedAttempt } from './rate-limit.js';
import {
  buildOtpauthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode,
} from './totp.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MFA_TOKEN_TTL_SECONDS = 5 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;

interface MfaTokenPayload extends jwt.JwtPayload {
  sub: string;
  purpose: 'mfa_setup' | 'mfa_verify';
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

function toAuthUserDto(user: {
  id: string;
  username: string;
  email: string;
  totpEnabled: boolean;
  role: { name: string };
}): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role.name as RoleName,
    totpEnabled: user.totpEnabled,
  };
}

function signAccessToken(
  user: { id: string; tokenVersion: number; role: { name: string } },
  jwtSecret: string,
): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role.name,
      tokenVersion: user.tokenVersion,
      type: 'access',
    },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_TTL_SECONDS },
  );
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  { config, prisma }: { config: ApiConfig; prisma: PrismaClient },
): Promise<void> {
  const authenticate = createAuthenticateHook(config, prisma);

  app.post<{ Body: LoginRequest }>('/api/auth/login', async (request, reply) => {
    const username = request.body?.username?.trim();
    const password = request.body?.password;

    if (!username || !password) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }

    const rateKey = `login:${username.toLowerCase()}`;
    const rateStatus = await checkRateLimit(prisma, rateKey);
    if (!rateStatus.allowed) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Account temporarily locked due to too many failed attempts. Try again in ${rateStatus.retryAfterSeconds}s.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user) {
      await recordFailedAttempt(prisma, rateKey);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    if (!user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account is disabled',
      });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await recordFailedAttempt(prisma, rateKey);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    await clearRateLimit(prisma, rateKey);

    if (!user.totpEnabled) {
      const secretBase32 = generateTotpSecret();
      const totpSecretEncrypted = encryptTotpSecret(secretBase32, config.totpEncryptionKey);

      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecretEncrypted },
      });

      const mfaToken = jwt.sign(
        { sub: user.id, purpose: 'mfa_setup' },
        config.jwtSecret,
        { algorithm: 'HS256', expiresIn: MFA_TOKEN_TTL_SECONDS },
      );

      const response: LoginResponse = {
        status: 'MFA_SETUP_REQUIRED',
        mfaToken,
        otpauthUri: buildOtpauthUri(user.username, secretBase32),
        secretBase32,
        user: toAuthUserDto(user),
      };
      return reply.status(200).send(response);
    }

    const mfaToken = jwt.sign(
      { sub: user.id, purpose: 'mfa_verify' },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: MFA_TOKEN_TTL_SECONDS },
    );

    const response: LoginResponse = {
      status: 'MFA_REQUIRED',
      mfaToken,
      user: toAuthUserDto(user),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Body: VerifyOtpRequest }>('/api/auth/verify-otp', async (request, reply) => {
    const mfaToken = request.body?.mfaToken;
    const code = request.body?.code?.trim();

    if (!mfaToken || !code) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'mfaToken and 6-digit code are required',
      });
    }

    let payload: MfaTokenPayload;
    try {
      payload = jwt.verify(mfaToken, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as MfaTokenPayload;
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired MFA token',
      });
    }

    if (
      typeof payload.sub !== 'string' ||
      (payload.purpose !== 'mfa_setup' && payload.purpose !== 'mfa_verify')
    ) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid MFA token purpose',
      });
    }

    const otpRateKey = `otp:${payload.sub}`;
    const rateStatus = await checkRateLimit(prisma, otpRateKey);
    if (!rateStatus.allowed) {
      return reply.status(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Too many failed OTP attempts. Try again in ${rateStatus.retryAfterSeconds}s.`,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || !user.totpSecretEncrypted) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'User cannot complete MFA verification',
      });
    }

    const secretBase32 = decryptTotpSecret(user.totpSecretEncrypted, config.totpEncryptionKey);
    if (!verifyTotpCode(secretBase32, code)) {
      await recordFailedAttempt(prisma, otpRateKey);
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid 6-digit authenticator code',
      });
    }

    await clearRateLimit(prisma, otpRateKey);

    const updatedUser =
      payload.purpose === 'mfa_setup' && !user.totpEnabled
        ? await prisma.user.update({
            where: { id: user.id },
            data: { totpEnabled: true },
            include: { role: true },
          })
        : user;

    const accessToken = signAccessToken(updatedUser, config.jwtSecret);
    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: updatedUser.id,
        tokenHash: hashToken(refreshToken),
        familyId: crypto.randomUUID(),
        expiresAt,
      },
    });

    const response: AuthTokensResponse = {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: toAuthUserDto(updatedUser),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Body: RefreshRequest }>('/api/auth/refresh', async (request, reply) => {
    const rawRefreshToken = request.body?.refreshToken?.trim();
    if (!rawRefreshToken) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'refreshToken is required',
      });
    }

    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawRefreshToken) },
      include: { user: { include: { role: true } } },
    });

    if (!existing) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid refresh token',
      });
    }

    if (existing.revokedAt !== null || existing.replacedByTokenId !== null) {
      await prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Refresh token reuse detected; session family revoked',
      });
    }

    if (existing.expiresAt <= new Date()) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Refresh token expired',
      });
    }

    if (!existing.user.isActive) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Account is disabled',
      });
    }

    const nextRefreshToken = generateOpaqueToken();
    const nextExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: hashToken(nextRefreshToken),
          familyId: existing.familyId,
          expiresAt: nextExpiresAt,
        },
      });
      await tx.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: now, replacedByTokenId: created.id },
      });
    });

    const response: AuthTokensResponse = {
      accessToken: signAccessToken(existing.user, config.jwtSecret),
      refreshToken: nextRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: toAuthUserDto(existing.user),
    };
    return reply.status(200).send(response);
  });

  app.post<{ Body: LogoutRequest }>('/api/auth/logout', async (request, reply) => {
    const rawRefreshToken = request.body?.refreshToken?.trim();
    if (!rawRefreshToken) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'refreshToken is required',
      });
    }

    const existing = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(rawRefreshToken) },
    });

    if (existing) {
      await prisma.refreshToken.updateMany({
        where: { familyId: existing.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const response: LogoutResponse = { success: true };
    return reply.status(200).send(response);
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    return request.authUser!;
  });
}
