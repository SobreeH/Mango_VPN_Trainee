#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, '.local', 'postgres');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value.replace(/\s+#.*$/, '');
  }
}

loadEnv();

const required = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'POSTGRES_PORT'];
const missing = required.filter((key) => !String(process.env[key] || '').trim());
if (missing.length) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}. Set them in .env or the environment.`);
  process.exit(1);
}

const config = {
  databaseDir: DATA_DIR,
  user: process.env.POSTGRES_USER.trim(),
  password: process.env.POSTGRES_PASSWORD,
  port: Number(process.env.POSTGRES_PORT),
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  autoRehydrateSymlinks: true,
};
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
  console.error('POSTGRES_PORT must be a valid TCP port (1-65535).');
  process.exit(1);
}

async function start() {
  const postgres = new EmbeddedPostgres(config);
  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) await postgres.initialise();
  await postgres.start();
  for (const database of [process.env.POSTGRES_DB.trim(), 'mangovpn_v2_test']) {
    try {
      await postgres.createDatabase(database);
    } catch (error) {
      if (!/already exists/i.test(String(error?.message || error))) throw error;
    }
  }
  const maskedUrl = `postgresql://${encodeURIComponent(config.user)}:***@127.0.0.1:${config.port}/${encodeURIComponent(process.env.POSTGRES_DB.trim())}`;
  console.log(`PostgreSQL running at 127.0.0.1:${config.port}`);
  console.log(`DATABASE_URL=${maskedUrl}`);
  console.log('Next steps:');
  console.log('  npm run db:migrate');
  console.log(`  DATABASE_URL=postgresql://${encodeURIComponent(config.user)}:<password>@127.0.0.1:${config.port}/mangovpn_v2_test npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log('Stopping embedded PostgreSQL...');
    await postgres.stop();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await new Promise(() => {});
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function reset() {
  const pidFile = path.join(DATA_DIR, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    const pid = Number.parseInt(fs.readFileSync(pidFile, 'utf8').split(/\r?\n/)[0], 10);
    if (isProcessAlive(pid)) {
      console.error('PostgreSQL appears to be running. Press Ctrl+C in db:start first.');
      process.exit(1);
    }
  }
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`Removed local PostgreSQL data at ${DATA_DIR}`);
}

const command = process.argv[2];
if (command === 'start') await start();
else if (command === 'reset') await reset();
else {
  console.error('Usage: node scripts/dev-db.mjs <start|reset>');
  process.exit(1);
}
