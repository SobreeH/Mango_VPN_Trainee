import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const AES_ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

export function encodeBase32(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

export function decodeBase32(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid Base32 character in TOTP secret');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

/** Generates a 160-bit Base32-encoded TOTP secret. */
export function generateTotpSecret(): string {
  return encodeBase32(crypto.randomBytes(20));
}

export function buildOtpauthUri(
  username: string,
  secretBase32: string,
  issuer = 'MANGO VPN',
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const label = `${encodedIssuer}:${encodeURIComponent(username)}`;
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function encryptTotpSecret(secretBase32: string, hexKey: string): string {
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptTotpSecret(encrypted: string, hexKey: string): string {
  const parts = encrypted.split(':');
  const [ivB64, tagB64, dataB64] = parts;
  if (parts.length !== 3 || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Malformed encrypted TOTP secret');
  }
  const key = Buffer.from(hexKey, 'hex');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv(AES_ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function generateHotp(key: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const lastByte = hmac.at(-1) ?? 0;
  const offset = lastByte & 0x0f;
  const binary =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

/** Verifies a 6-digit RFC 6238 TOTP code within ±1 time step (30s). */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  timestampMs = Date.now(),
  windowSteps = 1,
): boolean {
  if (!/^\d{6}$/.test(code)) {
    return false;
  }
  const key = decodeBase32(secretBase32);
  const currentCounter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
  const codeBuf = Buffer.from(code, 'utf8');

  for (let delta = -windowSteps; delta <= windowSteps; delta++) {
    const candidate = generateHotp(key, currentCounter + delta);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (crypto.timingSafeEqual(codeBuf, candidateBuf)) {
      return true;
    }
  }
  return false;
}
