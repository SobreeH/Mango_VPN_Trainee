#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalDir = path.resolve(__dirname, '../Rain/portal');

const instances = [
  { role: 'Admin', port: 3000, color: '\x1b[33m' },   // Amber
  { role: 'Staff', port: 3001, color: '\x1b[36m' },   // Cyan
  { role: 'Client', port: 3002, color: '\x1b[32m' },  // Green
];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`${BOLD}🥭 MANGO VPN — Launching All 3 Role Portals...${RESET}`);
console.log(`  🛡️  Admin Portal  : http://localhost:3000`);
console.log(`  💼  Staff Portal  : http://localhost:3001`);
console.log(`  🌐  Client Portal : http://localhost:3002\n`);

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const procs = instances.map(({ role, port, color }) => {
  const child = spawn(npmCmd, ['run', 'dev', '--', '--port', String(port)], {
    cwd: portalDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
  });

  const prefix = `${color}[${role} :${port}]${RESET} `;

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.log(`${prefix}${line}`);
    }
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      console.error(`${prefix}${line}`);
    }
  });

  return child;
});

function cleanup() {
  console.log(`\n${BOLD}Shutting down all role portals...${RESET}`);
  for (const child of procs) {
    try {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
      } else {
        child.kill('SIGINT');
      }
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
