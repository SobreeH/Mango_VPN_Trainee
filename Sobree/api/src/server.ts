import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrismaClient } from './lib/prisma.js';

async function start(): Promise<void> {
  const config = loadConfig();
  const prisma = createPrismaClient(config.databaseUrl);
  const app = await buildApp({ config, prisma });

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error('Failed to start MANGO VPN API:', err);
  process.exit(1);
});
