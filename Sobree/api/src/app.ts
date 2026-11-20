import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import { RoleName, type HealthResponse } from '@mango/shared';
import { adminPlugin } from '@mango/rain-admin';
import type { ApiConfig } from './config.js';
import { HttpVpnDaemonClient, type VpnDaemonClient } from './lib/vpn-daemon.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerVpnRoutes } from './modules/vpn/vpn.routes.js';
import { createAuthMiddleware } from './middleware/auth.js';

export type { VpnDaemonClient };

export interface AppDependencies {
  config: ApiConfig;
  prisma: PrismaClient;
  vpnDaemon?: VpnDaemonClient;
}

export async function buildApp({
  config,
  prisma,
  vpnDaemon,
}: AppDependencies): Promise<FastifyInstance> {
  const daemonClient = vpnDaemon ?? new HttpVpnDaemonClient(config);
  const app = Fastify({
    logger: config.nodeEnv !== 'test',
  });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const response: HealthResponse = {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
      return reply.status(200).send(response);
    } catch {
      const response: HealthResponse = {
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
      return reply.status(503).send(response);
    }
  });

  const { authenticate, requireRole } = createAuthMiddleware(config, prisma);
  await registerAuthRoutes(app, { config, prisma });
  await registerVpnRoutes(app, { config, prisma, vpnDaemon: daemonClient });
  await app.register(adminPlugin, {
    prefix: '/api',
    prisma,
    authenticate,
    requireAdmin: requireRole(RoleName.ADMIN),
    vpnDaemon: daemonClient,
    syncPolicies: (req) => daemonClient.syncPolicies(req),
  });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
