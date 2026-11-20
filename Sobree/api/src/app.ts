import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { PrismaClient } from '@prisma/client';
import type { HealthResponse } from '@mango/shared';
import { adminPlugin } from '@mango/rain-admin';
import type { ApiConfig } from './config.js';

export interface AppDependencies {
  config: ApiConfig;
  prisma: PrismaClient;
}

export async function buildApp({ config, prisma }: AppDependencies): Promise<FastifyInstance> {
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

  await app.register(adminPlugin, { prefix: '/api' });

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
