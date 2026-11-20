import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { AuthUserDto, RoleName } from '@mango/shared';
import jwt from 'jsonwebtoken';
import type { ApiConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUserDto;
  }
}

export interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  role: RoleName;
  tokenVersion: number;
  type: 'access';
}

/**
 * Verifies the HS256-pinned Bearer access token and attaches `request.authUser`.
 */
export function createAuthenticateHook(config: ApiConfig, prisma: PrismaClient) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    let payload: AccessTokenPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret, {
        algorithms: ['HS256'],
      }) as AccessTokenPayload;
    } catch {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired access token',
      });
    }

    if (payload.type !== 'access' || typeof payload.sub !== 'string') {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid access token payload',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Session is no longer valid',
      });
    }

    request.authUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role.name as RoleName,
      totpEnabled: user.totpEnabled,
    };
  };
}

/**
 * Enforces that the authenticated user holds one of the allowed roles.
 */
export function requireRole(...allowedRoles: RoleName[]) {
  return async function roleGuard(request: FastifyRequest, reply: FastifyReply) {
    if (!request.authUser) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }
    if (!allowedRoles.includes(request.authUser.role)) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient role permissions',
      });
    }
  };
}
