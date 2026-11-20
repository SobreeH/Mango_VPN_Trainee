#!/usr/bin/env node
/**
 * Automated guardrail scanner for MANGO VPN.
 * Blocks common AI-introduced security regressions (hardcoded secret fallbacks,
 * production MOCK_* fallbacks, wildcard/reflected agent CORS, SYS_MODULE).
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
