import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import jwt from 'jsonwebtoken';
import type { PrismaClient } from '@prisma/client';
import { RoleName } from '@mango/shared';
import type { ApiConfig } from '../config.js';

export interface AuthUser {
  id: string;
  username: string;
  role: RoleName;
  tokenVersion: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

interface JwtClaims {
  sub?: unknown;
  username?: unknown;
  role?: unknown;
  tokenVersion?: unknown;
}

function sendAuthError(reply: FastifyReply, statusCode: 401 | 403, error: string, message: string) {
  return reply.status(statusCode).send({ statusCode, error, message });
}

export function createAuthMiddleware(config: ApiConfig, prisma: PrismaClient) {
  const authenticate: preHandlerHookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendAuthError(reply, 401, 'Unauthorized', 'Missing or invalid Authorization header');
    }

    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return sendAuthError(reply, 401, 'Unauthorized', 'Missing bearer token');
    }

    let claims: JwtClaims;
    try {
      claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as JwtClaims;
    } catch {
      return sendAuthError(reply, 401, 'Unauthorized', 'Invalid or expired access token');
    }

    if (
      typeof claims.sub !== 'string' ||
      typeof claims.role !== 'string' ||
      typeof claims.tokenVersion !== 'number'
    ) {
      return sendAuthError(reply, 401, 'Unauthorized', 'Malformed access token claims');
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      include: { role: true },
    });

    if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) {
      return sendAuthError(reply, 401, 'Unauthorized', 'Session is no longer active');
    }

    request.authUser = {
      id: user.id,
      username: user.username,
      role: user.role.name as RoleName,
      tokenVersion: user.tokenVersion,
    };
  };

  const requireRole = (...allowedRoles: RoleName[]): preHandlerHookHandler => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.authUser) {
        return sendAuthError(reply, 401, 'Unauthorized', 'Authentication required');
      }
      if (!allowedRoles.includes(request.authUser.role)) {
        return sendAuthError(
          reply,
          403,
          'Forbidden',
          `Requires one of roles: ${allowedRoles.join(', ')}`,
        );
      }
    };
  };

  return { authenticate, requireRole };
}
