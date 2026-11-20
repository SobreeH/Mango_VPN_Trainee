#!/usr/bin/env node
/**
 * Automated guardrail scanner for MANGO VPN.
 * Blocks common AI-introduced security regressions (hardcoded secret fallbacks,
 * production MOCK_* fallbacks, wildcard/reflected agent CORS, SYS_MODULE,
 * and unsafe dev database/daemon simulator configuration.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_DIRS = ['Rain', 'Sobree', 'packages'];
const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

const failures = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (/\.(ts|tsx|js|jsx|mjs|go|yml|yaml)$/.test(entry.name)) {
      scanFile(full);
    }
  }
}

function scanFile(filePath) {
  const rel = path.relative(ROOT, filePath).replaceAll('\\', '/');
  const isTest = /\.(test|spec)\.|_test\.go$/.test(rel);
  if (isTest) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;

    // 1. Hardcoded secret fallbacks
    if (
      /(JWT_SECRET|REFRESH_SECRET|TOTP_ENCRYPTION_KEY|DAEMON_SHARED_SECRET)\s*(\|\||\?\?)\s*['"`]/.test(
        line,
      )
    ) {
      failures.push(`${rel}:${lineNo} — hardcoded secret fallback is forbidden`);
    }

    // 2. Production MOCK_* fallbacks in Rain/portal or Rain/admin
    if (rel.startsWith('Rain/') && /\bMOCK_(USERS|DEVICES|POLICIES|SESSIONS|LOGS)\b/.test(line)) {
      failures.push(`${rel}:${lineNo} — MOCK_* fallback data is forbidden in production UI/admin`);
    }

    // 3. Wildcard or reflected Origin in Windows Agent
    if (rel.startsWith('Sobree/agent-windows/') && /Access-Control-Allow-Origin.*\*/.test(line)) {
      failures.push(`${rel}:${lineNo} — wildcard Access-Control-Allow-Origin is forbidden in agent-windows`);
    }
  });
}

for (const dir of TARGET_DIRS) {
  walk(path.join(ROOT, dir));
}

// 5. Docker-free dev tooling (scripts/ is outside TARGET_DIRS, so scan explicitly)
for (const rel of ['scripts/mock-daemon.js', 'scripts/dev-db.mjs']) {
  const file = path.join(ROOT, rel);
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (/(JWT_SECRET|REFRESH_SECRET|TOTP_ENCRYPTION_KEY|DAEMON_SHARED_SECRET)\s*(\|\||\?\?)\s*['"`]/.test(line)) {
        failures.push(`${rel}:${index + 1} — hardcoded secret fallback is forbidden`);
      }
      if (/POSTGRES_PASSWORD\s*(\|\||\?\?)\s*['"`]/.test(line)) {
        failures.push(`${rel}:${index + 1} — hardcoded database password fallback is forbidden`);
      }
    });
    if (rel.endsWith('mock-daemon.js')) {
      if (/0\.0\.0\.0|['"]::['"]/.test(content)) failures.push(`${rel} — non-loopback listen host is forbidden`);
      if (!content.includes('DEV MOCK DAEMON')) failures.push(`${rel} — required dev mock daemon banner is missing`);
    }
  }
}

// 6. The dev-only mock daemon must never be wired into Docker images or Compose
function findDockerfiles(dir, found = []) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) findDockerfiles(full, found);
    else if (entry.isFile() && entry.name.startsWith('Dockerfile')) found.push(full);
  }
  return found;
}
const dockerFiles = [
  path.join(ROOT, 'docker-compose.yml'),
  ...findDockerfiles(path.join(ROOT, 'Rain')),
  ...findDockerfiles(path.join(ROOT, 'Sobree')),
];
for (const file of dockerFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (/mock-daemon/.test(content)) failures.push(`${path.relative(ROOT, file).replaceAll('\\', '/')} — must not reference mock-daemon`);
  }
}

// 4. SYS_MODULE in docker-compose.yml
const composePath = path.join(ROOT, 'docker-compose.yml');
if (fs.existsSync(composePath)) {
  const compose = fs.readFileSync(composePath, 'utf8');
  if (/\bSYS_MODULE\b/.test(compose)) {
    failures.push('docker-compose.yml — SYS_MODULE capability is forbidden');
  }
}

if (failures.length > 0) {
  console.error('❌ Guardrail check failed:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}

console.log('✅ Guardrail check passed (0 violations).');
