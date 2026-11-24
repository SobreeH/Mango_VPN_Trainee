#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const portalDir = path.resolve(rootDir, 'Rain/portal');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const nodeCmd = process.execPath;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';

console.log(`${BOLD}============================================================${RESET}`);
console.log(`${BOLD}🥭 MANGO VPN — All-in-One Live Demo Environment${RESET}`);
console.log(`${BOLD}============================================================${RESET}`);
console.log(`  🛡️  ${YELLOW}Admin Portal  : http://localhost:3000${RESET} (Account: admin)`);
console.log(`  💼  ${CYAN}Staff Portal  : http://localhost:3001${RESET} (Account: somchai_staff)`);
console.log(`  🌐  ${GREEN}Client Portal : http://localhost:3002${RESET} (Account: wansob_test)`);
console.log(`  🔌  ${MAGENTA}Windows Agent : http://127.0.0.1:47821${RESET}`);
console.log(`${BOLD}============================================================${RESET}`);
console.log(`  กด ${BOLD}Ctrl + C${RESET} เพื่อปิดระบบทดสอบทั้งหมดพร้อมกัน\n`);

const procs = [];

// 1. Launch Mock Agent
const agentProc = spawn(nodeCmd, ['scripts/mock-agent.js'], {
  cwd: rootDir,
  stdio: ['ignore', 'pipe', 'pipe'],
});
procs.push(agentProc);

agentProc.stdout.on('data', (data) => {
  const str = data.toString();
  const tokenMatch = str.match(/PairingToken:\s+([A-Za-z0-9_-]+)/);
  if (tokenMatch) {
    console.log(`\n🔑 ${BOLD}${YELLOW}Agent Pairing Token ล่าสุด:${RESET} ${BOLD}${tokenMatch[1]}${RESET}\n`);
  }
});

// 2. Launch Portals on 3000, 3001, 3002
const portalInstances = [
  { role: 'Admin', port: 3000, color: YELLOW },
  { role: 'Staff', port: 3001, color: CYAN },
  { role: 'Client', port: 3002, color: GREEN },
];

for (const { role, port, color } of portalInstances) {
  const p = spawn(npmCmd, ['run', 'dev', '--', '--port', String(port)], {
    cwd: portalDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWindows,
  });
  procs.push(p);

  const prefix = `${color}[${role} :${port}]${RESET} `;
  p.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      if (line.includes('ready in') || line.includes('Local:')) {
        console.log(`${prefix}${line.trim()}`);
      }
    }
  });
}

function cleanup() {
  console.log(`\n${BOLD}Shutting down all demo services...${RESET}`);
  for (const child of procs) {
    try {
      if (isWindows && child.pid) {
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
