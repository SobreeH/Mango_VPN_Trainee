import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createPrismaClient } from './lib/prisma.js';

// Load workspace .env first if present, then fall back to monorepo root .env
// without overriding variables already supplied by the shell/container.
dotenv.config();
const repoRootEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../.env',
);
if (fs.existsSync(repoRootEnv)) {
  dotenv.config({ path: repoRootEnv });
}

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
