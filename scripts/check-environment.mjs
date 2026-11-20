#!/usr/bin/env node
// MANGO VPN environment readiness check. Zero dependencies; runs on Linux, macOS, and Windows.
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';

const IS_WINDOWS = process.platform === 'win32';
const ROLES = ['All', 'Rain', 'Sobree'];
const USAGE = `Usage: node scripts/check-environment.mjs [--role All|Rain|Sobree] [--strict]

Checks local tooling for MANGO VPN on Linux, macOS, and Windows.

Options:
  --role, -Role <value>   Role to check: All (default), Rain, or Sobree (case-insensitive)
  --strict                Under --role All, also exit 1 when Sobree tools are missing
  -h, --help              Show this help

Exit codes: 0 = required tools READY, 1 = required tool missing, 2 = invalid arguments`;

function parseArgs(argv) {
  const options = { role: 'All', strict: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (/^(--role|-Role)(=|$)/i.test(arg)) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      const role = ROLES.find((candidate) => candidate.toLowerCase() === String(value ?? '').toLowerCase());
      if (!role) throw new Error(`Invalid role "${value ?? ''}". Expected one of: ${ROLES.join(', ')}.`);
      options.role = role;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

// Windows needs a shell for npm.cmd; the args here are fixed literals, so joining them is safe.
function execTool(command, args, options) {
  if (IS_WINDOWS) return execFileSync([command, ...args].join(' '), { ...options, shell: true });
  return execFileSync(command, args, options);
}

function run(command, args) {
  try {
    const stdout = execTool(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
      windowsHide: true,
    });
    return { ok: true, output: String(stdout).trim() };
  } catch {
    return { ok: false, output: '' };
  }
}

function parseVersion(text) {
  const match = text.match(/(\d+\.\d+(?:\.\d+)?)/);
  return match ? match[1].split('.').map(Number) : null;
}

function compareVersions(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

const CORE_TOOLS = [
  { name: 'Node.js', command: 'node', args: ['-v'], min: [18, 0, 0], minLabel: '>= 18.0.0', tier: 'core' },
  { name: 'npm', command: 'npm', args: ['-v'], min: [9, 0, 0], minLabel: '>= 9.0.0', tier: 'core' },
  { name: 'Git', command: 'git', args: ['--version'], min: [2, 30, 0], minLabel: '>= 2.30.0', tier: 'core' },
];

const SOBREE_TOOLS = [
  { name: 'Docker CLI', command: 'docker', args: ['-v'], min: [24, 0, 0], minLabel: '>= 24.0.0', tier: 'sobree' },
  { name: 'Docker Compose', command: 'docker', args: ['compose', 'version'], min: [2, 20, 0], minLabel: '>= v2.20.0', tier: 'sobree' },
  {
    name: 'Go Toolchain',
    command: 'go',
    args: ['version'],
    min: [1, 22, 0],
    minLabel: '>= 1.22.0 (1.26+ for agent)',
    recommended: [1, 26, 0],
    tier: 'sobree',
  },
];

const REQUIRED_FOR = {
  core: 'Both (Rain & Sobree)',
  sobree: 'Sobree (Senior Dev)',
};

function nativeTools() {
  if (IS_WINDOWS) {
    return [{ name: 'WireGuard (wireguard.exe)', command: 'where.exe', args: ['wireguard.exe'] }];
  }
  if (process.platform === 'linux') {
    return [
      { name: 'WireGuard (wg)', command: 'wg', args: ['--version'] },
      { name: 'wg-quick', command: 'sh', args: ['-c', 'command -v wg-quick'] },
      { name: 'ip', command: 'ip', args: ['-V'] },
      { name: 'nft', command: 'nft', args: ['--version'] },
    ];
  }
  return [];
}

function checkTool(tool, role) {
  const result = run(tool.command, tool.args);
  const firstLine = result.ok ? result.output.split(/\r?\n/)[0].trim() : '';
  const version = firstLine ? parseVersion(firstLine) : null;
  const meetsMin = version !== null && compareVersions(version, tool.min) >= 0;
  const optional = tool.tier === 'sobree' && role === 'Rain';

  let status;
  let detected;
  if (result.ok && (meetsMin || version === null)) {
    status = 'READY';
    detected = firstLine || 'installed';
  } else if (result.ok) {
    status = 'MISSING';
    detected = `${firstLine} (too old)`;
  } else {
    status = optional ? 'OPTIONAL' : 'MISSING';
    detected = 'Not found on PATH';
  }
  if (status === 'MISSING' && optional) status = 'OPTIONAL';

  return {
    name: tool.name,
    status,
    detected,
    requiredFor: REQUIRED_FOR[tool.tier],
    minimum: tool.minLabel,
    tier: tool.tier,
    version,
    recommended: tool.recommended,
  };
}

function checkNativeTool(tool) {
  const result = run(tool.command, tool.args);
  const firstLine = result.ok ? result.output.split(/\r?\n/)[0].trim() : '';
  return {
    name: tool.name,
    status: result.ok ? 'READY' : 'OPTIONAL',
    detected: result.ok ? firstLine || 'found' : 'Not found on PATH',
    requiredFor: 'Sobree (real tunnel mode only)',
    minimum: '-',
  };
}

function checkDockerDaemon() {
  try {
    execTool('docker', ['info'], { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return 'REACHABLE (docker info succeeded)';
  } catch {
    return 'UNREACHABLE (start Docker Desktop on Windows, or the docker service on Linux)';
  }
}

function platformLabel() {
  const names = { win32: 'Windows', linux: 'Linux', darwin: 'macOS' };
  return `${names[process.platform] ?? process.platform} (${process.platform}) ${os.release()} | arch: ${process.arch}`;
}

function installHint(name) {
  if (IS_WINDOWS) {
    const hints = {
      'Node.js': 'winget install OpenJS.NodeJS.LTS',
      npm: 'bundled with Node.js',
      Git: 'winget install Git.Git',
      'Docker CLI': 'winget install Docker.DockerDesktop, then start Docker Desktop',
      'Docker Compose': 'bundled with Docker Desktop',
      'Go Toolchain': 'winget install GoLang.Go (or the .msi from https://go.dev/dl/)',
    };
    return hints[name];
  }
  const hints = {
    'Node.js': 'install the LTS release from https://nodejs.org/ or your package manager',
    npm: 'bundled with Node.js',
    Git: 'install git with your package manager (for example: sudo apt install git)',
    'Docker CLI': 'install Docker Engine from https://docs.docker.com/engine/install/',
    'Docker Compose': 'install the docker-compose-plugin (v2) package',
    'Go Toolchain': 'install Go 1.26+ from https://go.dev/dl/',
  };
  return hints[name];
}

function printTable(rows) {
  const headers = ['Tool', 'Status', 'Detected', 'Required For', 'Minimum'];
  const clip = (value) => String(value).slice(0, 44);
  const body = rows.map((row) => [row.name, row.status, clip(row.detected), row.requiredFor, row.minimum]);
  const widths = headers.map((header, i) => Math.max(header.length, ...body.map((cells) => cells[i].length)));
  const line = (cells) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ').trimEnd();
  console.log(line(headers));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  body.forEach((cells) => console.log(line(cells)));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const { role, strict } = options;
  const coreRows = CORE_TOOLS.map((tool) => checkTool(tool, role));
  const sobreeRows = SOBREE_TOOLS.map((tool) => checkTool(tool, role));
  const tools = [...coreRows, ...sobreeRows];
  const nativeRows = nativeTools().map(checkNativeTool);
  const dockerDaemon = sobreeRows[0].status === 'READY' ? checkDockerDaemon() : 'NOT CHECKED (Docker CLI missing)';

  console.log('');
  console.log('============================================================');
  console.log('   MANGO VPN - Development Environment Readiness Check');
  console.log('============================================================');
  console.log(`Role      : ${role}`);
  console.log(`Platform  : ${platformLabel()}`);
  console.log('');
  console.log('Tool Status:');
  printTable(tools);
  console.log('');

  if (nativeRows.length) {
    console.log('WireGuard / Gateway Tools (OPTIONAL unless you run a real tunnel):');
    printTable(nativeRows);
  } else {
    console.log('WireGuard / Gateway Tools: not checked on this platform (use Docker vpn-gateway or the mock daemon).');
  }
  console.log('');
  console.log(`Docker daemon: ${dockerDaemon}`);
  console.log('');

  const missingCore = coreRows.filter((row) => row.status === 'MISSING');
  const missingSobree = sobreeRows.filter((row) => row.status === 'MISSING');
  const goRow = sobreeRows.find((row) => row.name === 'Go Toolchain');
  const goBelowRecommended =
    goRow?.status === 'READY' && goRow.version && compareVersions(goRow.version, goRow.recommended) < 0;

  console.log('Role Readiness Summary:');
  if (missingCore.length === 0) {
    console.log('  [READY] Rain (Junior Dev): Node.js, npm, and Git are installed.');
    console.log(
      '          Next: npm run db:start | npm run mock:daemon | npm run mock:agent | npm run dev:api | npm run dev:portal',
    );
  } else {
    console.log(`  [BLOCKED] Rain (Junior Dev): missing ${missingCore.map((row) => row.name).join(', ')}.`);
    missingCore.forEach((row) => console.log(`            - ${row.name}: ${installHint(row.name)}`));
  }

  if (role === 'Rain') {
    console.log('  [SKIPPED] Sobree readiness is not required for --role Rain (Docker and Go are OPTIONAL).');
  } else if (missingSobree.length === 0 && !goBelowRecommended) {
    console.log('  [READY] Sobree (Senior Dev): Node.js, Docker, Docker Compose, and Go are installed.');
    console.log(`          Docker daemon: ${dockerDaemon.split(' ')[0]}`);
  } else {
    const label = role === 'Sobree' ? '[BLOCKED]' : '[PARTIAL]';
    console.log(`  ${label} Sobree (Senior Dev):`);
    missingSobree.forEach((row) => console.log(`            - ${row.name} missing: ${installHint(row.name)}`));
    if (goBelowRecommended) {
      console.log(`            - Go ${goRow.detected} is below 1.26, which Sobree/agent-windows/go.mod requires.`);
    }
    if (IS_WINDOWS) {
      console.log('          Agent: run from an Administrator PowerShell (cd Sobree\\agent-windows; go run .)');
    } else {
      console.log('          Agent: run as root (cd Sobree/agent-windows && sudo -E go run .)');
    }
  }

  const sobreeNativeMissing = nativeRows.some((row) => row.status === 'OPTIONAL');
  if (role !== 'Rain' && sobreeNativeMissing) {
    console.log('  [NOTE] Native WireGuard tools not found. Docker vpn-gateway or the mock daemon still works;');
    console.log('         real tunnel activation needs wireguard.exe (Windows) or wg-quick (Linux).');
  }

  let exitCode = 0;
  if (missingCore.length > 0) exitCode = 1;
  if (role === 'Sobree' && missingSobree.length > 0) exitCode = 1;
  if (role === 'All' && missingSobree.length > 0 && strict) exitCode = 1;

  console.log('');
  console.log('============================================================');
  if (exitCode !== 0) {
    console.log(`Result: FAILED (exit 1) - required tools are missing for --role ${role}.`);
  } else if (role === 'All' && missingSobree.length > 0) {
    console.log('Result: PARTIAL (exit 0) - Rain tools are ready; Sobree tools are missing. Use --strict to fail.');
  } else {
    console.log('Result: PASSED (exit 0)');
  }
  console.log('============================================================');
  process.exitCode = exitCode;
}

main();
