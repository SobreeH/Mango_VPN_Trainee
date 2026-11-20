#!/usr/bin/env node
/* Must stay in sync with Sobree/vpn-daemon/main.go (AGENTS.md Rule 6). */
/**
 * Dev-only loopback simulator. Payloads mirror Daemon* contracts in
 * packages/shared/src/contracts.ts and handlers/validation in main.go.
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
loadEnv();

const secretValue = process.env.DAEMON_SHARED_SECRET;
const SECRET = (typeof secretValue === 'string' ? secretValue : '').trim();
if (SECRET.length < 32) {
  console.error('DAEMON_SHARED_SECRET must be set and at least 32 characters.');
  process.exit(1);
}
function endpoint() {
  const raw = process.env.MOCK_DAEMON_PORT || (() => { try { return new URL(process.env.VPN_DAEMON_URL || '').port; } catch { return ''; } })() || '50051';
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MOCK_DAEMON_PORT/VPN_DAEMON_URL must specify a valid port');
  return port;
}
const PORT = endpoint();
const peers = new Map();
const MAX_BODY = 1e6;
class ContractError extends Error { constructor(code, message) { super(message); this.code = code; } }
const error = (res, status, code, message) => send(res, status, { success: false, error: { code, message } });
function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function auth(req, res) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return error(res, 401, 'UNAUTHORIZED', 'Missing Bearer authorization token');
  const provided = Buffer.from(header.slice(7));
  const expected = Buffer.from(SECRET);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return error(res, 401, 'UNAUTHORIZED', 'Invalid daemon authorization token');
  return true;
}
function body(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', (chunk) => { text += chunk; if (Buffer.byteLength(text) > MAX_BODY) reject(new Error('too large')); });
    req.on('end', () => { try { resolve(JSON.parse(text)); } catch { reject(new Error('invalid')); } });
    req.on('error', reject);
  });
}
function key(value) {
  const trimmed = String(value || '').trim();
  try { if (Buffer.from(trimmed, 'base64').length === 32 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) return trimmed; } catch {}
  throw new ContractError('INVALID_PUBLIC_KEY', 'publicKey must be a valid 32-byte base64 WireGuard key');
}
function ip(value) {
  const text = String(value || '').trim();
  const raw = text.replace(/\/32$/, '');
  const octets = raw.split('.');
  if (octets.length !== 4 || octets.some((o) => !/^\d+$/.test(o) || Number(o) > 255)) throw new ContractError('INVALID_IP', text.includes('/') ? 'assignedIp must be a valid IPv4 address or /32 CIDR' : 'assignedIp must be a valid IPv4 address');
  if (text.includes('/') && !/\/32$/.test(text)) throw new ContractError('INVALID_IP', 'assignedIp must be a valid IPv4 address or /32 CIDR');
  return `${octets.map(Number).join('.')}/32`;
}
function policyRules(rules) {
  return (rules || []).map((rule) => {
    const protocol = String(rule.protocol || '').trim().toUpperCase();
    const action = String(rule.action || '').trim().toUpperCase();
    if (!/^[^/]+\/\d+$/.test(String(rule.targetCidr || ''))) throw new ContractError('INVALID_POLICY', `invalid targetCidr ${JSON.stringify(rule.targetCidr)}: must be a valid IPv4 CIDR`);
    if (!['ANY', 'TCP', 'UDP', 'ICMP'].includes(protocol)) throw new ContractError('INVALID_POLICY', `invalid protocol ${JSON.stringify(rule.protocol)}: must be ANY, TCP, UDP, or ICMP`);
    if (!['ALLOW', 'DENY'].includes(action)) throw new ContractError('INVALID_POLICY', `invalid action ${JSON.stringify(rule.action)}: must be ALLOW or DENY`);
    return { targetCidr: String(rule.targetCidr).trim(), protocol, portRange: rule.portRange || null, action, priority: Number(rule.priority || 0) };
  }).sort((a, b) => a.priority - b.priority);
}
async function handle(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok', service: 'mango-vpn-daemon', mock: true });
  const known = ['/peers', '/peers/remove', '/policies/sync', '/peers/policies'];
  const isDelete = url.pathname.startsWith('/peers/') && req.method === 'DELETE';
  if (!(known.includes(url.pathname) || isDelete)) return error(res, 404, 'NOT_FOUND', `Endpoint ${url.pathname} not found on VPN daemon`);
  if (!auth(req, res)) return;
  try {
    if (req.method === 'POST' && url.pathname === '/peers') {
      const data = await body(req); const publicKey = key(data.publicKey); const assignedIp = ip(data.assignedIp); const policies = data.policies == null ? undefined : policyRules(data.policies);
      peers.set(publicKey, { publicKey, assignedIp, role: String(data.role || '').trim(), policies: policies || [] });
      console.log(`[DEV MOCK DAEMON] peer added: ${publicKey}`); return send(res, 200, { success: true, publicKey, assignedIp });
    }
    if ((req.method === 'POST' && url.pathname === '/policies/sync') || (req.method === 'PUT' && url.pathname === '/peers/policies')) {
      const data = await body(req); const next = new Map();
      for (const item of data.peers || []) { const publicKey = key(item.publicKey); next.set(publicKey, { publicKey, assignedIp: ip(item.assignedIp), role: String(item.role || '').trim(), policies: policyRules(item.policies) }); }
      peers.clear(); for (const [k, v] of next) peers.set(k, v); console.log(`[DEV MOCK DAEMON] policies synced: ${peers.size} peer(s)`); return send(res, 200, { success: true, peers: peers.size });
    }
    if (req.method === 'POST' && url.pathname === '/peers/remove') { const data = await body(req); const publicKey = key(data.publicKey); peers.delete(publicKey); console.log(`[DEV MOCK DAEMON] peer removed: ${publicKey}`); return send(res, 200, { success: true, publicKey }); }
    if (req.method === 'DELETE' && isDelete) { const publicKey = key(decodeURIComponent(url.pathname.slice('/peers/'.length))); peers.delete(publicKey); console.log(`[DEV MOCK DAEMON] peer removed: ${publicKey}`); return send(res, 200, { success: true, publicKey }); }
    return error(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  } catch (e) { return error(res, 400, e.message === 'invalid' ? 'INVALID_JSON' : e.message === 'too large' ? 'INVALID_JSON' : e.code || 'INVALID_POLICY', e.message === 'invalid' ? 'Request body must be valid JSON' : e.message === 'too large' ? 'Request body too large' : e.message); }
}
const server = http.createServer((req, res) => handle(req, res).catch((e) => error(res, 500, 'INTERNAL_ERROR', e.message)));
server.listen(PORT, '127.0.0.1', () => { console.log('[DEV MOCK DAEMON – no wg/nftables enforcement]'); console.log('This simulator does not program WireGuard or nftables.'); console.log(`Listening on http://127.0.0.1:${PORT}`); });
process.once('SIGINT', () => server.close(() => process.exit(0)));
process.once('SIGTERM', () => server.close(() => process.exit(0)));
