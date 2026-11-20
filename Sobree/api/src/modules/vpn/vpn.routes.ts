import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { ConnectTicketResponse } from '@mango/shared';
import type { ApiConfig } from '../../config.js';
import { createAuthenticateHook } from '../../middleware/auth.js';

const CONNECT_TICKET_TTL_SECONDS = 60;

export interface VpnRoutesDeps {
  config: ApiConfig;
  prisma: PrismaClient;
}

/**
 * Registers VPN control-plane endpoints (Connect Ticket issuance).
 */
export async function registerVpnRoutes(
  app: FastifyInstance,
  { config, prisma }: VpnRoutesDeps,
): Promise<void> {
  const authenticate = createAuthenticateHook(config, prisma);

  app.post(
    '/api/vpn/ticket',
    { preHandler: authenticate },
    async (request, reply) => {
      const authUser = request.authUser;
      if (!authUser) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const rawTicket = crypto.randomBytes(32).toString('base64url');
      const ticketHash = crypto.createHash('sha256').update(rawTicket).digest('hex');
      const expiresAt = new Date(Date.now() + CONNECT_TICKET_TTL_SECONDS * 1000);

      await prisma.$transaction(async (tx) => {
        const created = await tx.connectTicket.create({
          data: {
            userId: authUser.id,
            ticketHash,
            expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: authUser.id,
            action: 'VPN_TICKET_ISSUED',
            targetType: 'ConnectTicket',
            targetId: created.id,
            ipAddress: request.ip,
          },
        });
      });

      const response: ConnectTicketResponse = {
        ticket: rawTicket,
        expiresAt: expiresAt.toISOString(),
        expiresInSeconds: CONNECT_TICKET_TTL_SECONDS,
      };
      return reply.status(201).send(response);
    },
  );
}
