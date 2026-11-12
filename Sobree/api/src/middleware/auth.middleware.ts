import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { RoleName } from '@mango/shared';

export interface JwtUserPayload {
  userId: string;
  username: string;
  role: RoleName;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUserPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'mango-vpn-jwt-insecure-secret-key-32chars';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or malformed Authorization Bearer header',
      },
      timestamp: new Date().toISOString(),
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token!, JWT_SECRET) as JwtUserPayload;
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'JWT token is invalid or expired',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
