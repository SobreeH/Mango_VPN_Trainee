#!/usr/bin/env node
/**
 * Cross-platform `.env` and WireGuard X25519 keypair initializer for MANGO VPN.
 * Runs identically on Linux, macOS, and Windows with zero external dependencies.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TEMPLATE = path.join(ROOT, '.env.example');
const DEFAULT_OUTPUT = path.join(ROOT, '.env');

// RFC 8410 ASN.1 DER prefix for an X25519 PKCS#8 private key (16-byte header + 32-byte key).
const X25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b656e04220420', 'hex');

const USAGE = `Usage: node scripts/init-env.mjs [options]

Creates or updates .env from .env.example with fresh cryptographic secrets and
an X25519 WireGuard server keypair (UTF-8 without BOM).

Options:
  --force            Overwrite an existing .env file with newly generated secrets
  --wg-only          Only generate/update WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY
  --output <path>    Target env file path (default: .env at repository root)
  -h, --help         Show this help message`;

function parseArgs(argv) {
  const options = {
    force: false,
    wgOnly: false,
    output: DEFAULT_OUTPUT,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--wg-only') {
      options.wgOnly = true;
    } else if (arg === '--output' || arg.startsWith('--output=')) {
      const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      if (!value) {
        throw new Error('--output requires a file path.');
      }
      options.output = path.resolve(process.cwd(), value);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function generateWireGuardKeypair() {
  const privateBytes = crypto.randomBytes(32);
  // Clamp Curve25519 scalar per RFC 7748 / WireGuard specification.
  privateBytes[0] &= 248;
  privateBytes[31] &= 127;
  privateBytes[31] |= 64;

  const pkcs8Der = Buffer.concat([X25519_PKCS8_PREFIX, privateBytes]);
  const privateKeyObj = crypto.createPrivateKey({
    key: pkcs8Der,
    format: 'der',
    type: 'pkcs8',
  });
  const spkiDer = crypto.createPublicKey(privateKeyObj).export({
    format: 'der',
    type: 'spki',
  });
  const publicBytes = spkiDer.subarray(spkiDer.length - 32);

  return {
    privateKey: privateBytes.toString('base64'),
    publicKey: publicBytes.toString('base64'),
  };
}

function getEnvValue(text, key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}

function setEnvValue(text, key, value) {
  const lineRegex = new RegExp(`^${key}=.*$`, 'm');
  const nextLine = `${key}=${value}`;
  if (lineRegex.test(text)) {
    return text.replace(lineRegex, () => nextLine);
  }
  const suffix = text.endsWith('\n') || text === '' ? '' : '\n';
  return `${text}${suffix}${nextLine}\n`;
}

function writeUtf8NoBom(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content.replace(/^\uFEFF/, ''), { encoding: 'utf8', mode: 0o600 });
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

  if (!fs.existsSync(DEFAULT_TEMPLATE)) {
    console.error(`Template file not found: ${DEFAULT_TEMPLATE}`);
    process.exitCode = 1;
    return;
  }

  const targetPath = options.output;
  const displayPath = path.relative(ROOT, targetPath) || '.env';
  const exists = fs.existsSync(targetPath);

  if (exists && !options.force) {
    const existing = fs.readFileSync(targetPath, 'utf8');
    const hasWgPriv = getEnvValue(existing, 'WG_PRIVATE_KEY') !== '';
    const hasWgPub = getEnvValue(existing, 'WG_SERVER_PUBLIC_KEY') !== '';

    if (options.wgOnly || !hasWgPriv || !hasWgPub) {
      const { privateKey, publicKey } = generateWireGuardKeypair();
      let updated = setEnvValue(existing, 'WG_PRIVATE_KEY', privateKey);
      updated = setEnvValue(updated, 'WG_SERVER_PUBLIC_KEY', publicKey);
      writeUtf8NoBom(targetPath, updated);
      console.log(
        `Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in ${displayPath} (Server Public Key: ${publicKey})`,
      );
      return;
    }

    console.log(`${displayPath} already exists with secrets and WireGuard keys populated; leaving it unchanged.`);
    return;
  }

  let content = fs.readFileSync(DEFAULT_TEMPLATE, 'utf8');
  const pgUser = getEnvValue(content, 'POSTGRES_USER') || 'mango';
  const pgDb = getEnvValue(content, 'POSTGRES_DB') || 'mangovpn';
  const pgPort = getEnvValue(content, 'POSTGRES_PORT') || '15432';

  if (!options.wgOnly) {
    const dbPassword = crypto.randomBytes(24).toString('base64url');
    const jwtSecret = crypto.randomBytes(32).toString('base64');
    const refreshSecret = crypto.randomBytes(32).toString('base64');
    const daemonSecret = crypto.randomBytes(32).toString('base64');
    const totpKey = crypto.randomBytes(32).toString('hex');

    content = setEnvValue(content, 'POSTGRES_PASSWORD', dbPassword);
    content = setEnvValue(
      content,
      'DATABASE_URL',
      `postgresql://${pgUser}:${dbPassword}@localhost:${pgPort}/${pgDb}?schema=public`,
    );
    content = setEnvValue(content, 'JWT_SECRET', jwtSecret);
    content = setEnvValue(content, 'REFRESH_SECRET', refreshSecret);
    content = setEnvValue(content, 'DAEMON_SHARED_SECRET', daemonSecret);
    content = setEnvValue(content, 'TOTP_ENCRYPTION_KEY', totpKey);
  }

  const { privateKey, publicKey } = generateWireGuardKeypair();
  content = setEnvValue(content, 'WG_PRIVATE_KEY', privateKey);
  content = setEnvValue(content, 'WG_SERVER_PUBLIC_KEY', publicKey);

  writeUtf8NoBom(targetPath, content);
  console.log(
    `Created ${displayPath} with fresh random secrets and WireGuard keypair (UTF-8 without BOM). Server Public Key: ${publicKey}`,
  );
  console.log('Keep this file private and never commit it to git.');
}

main();
