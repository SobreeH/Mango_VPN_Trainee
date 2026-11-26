#!/usr/bin/env node

/**
 * MANGO VPN - Local Endpoint Agent Simulator
 *
 * Mirrors Sobree/agent-windows/main.go on http://127.0.0.1:47821:
 * - Strict Origin allowlist (never wildcard or unconditional reflection)
 * - Chromium Private Network Access (PNA) preflight headers
 * - Local pairing token (X-Mango-Agent-Token) on /status, /connect, /disconnect
 * - In-memory X25519 (Curve25519) keypair generation for WireGuard
 * - Multi-provider dispatch (WIREGUARD, FORTINET, CISCO) on POST /connect
 *
 * ZERO external dependencies. Runs directly with Node.js >= 18.
 */

const http = require('http');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

function loadDotenvFallback() {
  try {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          let v = trimmed.slice(eqIdx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  } catch {
    // ignore
  }
}
loadDotenvFallback();

const VALID_PROVIDERS = new Set(['WIREGUARD', 'FORTINET', 'CISCO']);

function getenvFirst(...keys) {
  for (const key of keys) {
    const val = process.env[key];
    if (typeof val === 'string' && val.trim() !== '') {
      return val.trim();
    }
  }
  return '';
}

function resolveHostAndPort() {
  const listenAddr = getenvFirst('AGENT_LISTEN_ADDR', 'MANGO_AGENT_ADDR');
  if (listenAddr) {
    const lastColon = listenAddr.lastIndexOf(':');
    if (lastColon > 0 && lastColon < listenAddr.length - 1) {
      const host = listenAddr.slice(0, lastColon).trim() || '127.0.0.1';
      const port = Number(listenAddr.slice(lastColon + 1).trim());
      if (Number.isInteger(port) && port > 0 && port <= 65535) {
        return { host, port };
      }
    }
  }
  return {
    host: getenvFirst('AGENT_HOST') || '127.0.0.1',
    port: Number(getenvFirst('AGENT_PORT') || 47821),
  };
}

const { host: HOST, port: PORT } = resolveHostAndPort();
const API_URL = (getenvFirst('API_URL', 'MANGO_API_URL') || 'http://localhost:4000').replace(/\/+$/, '');
const ALLOWED_ORIGINS = (
  getenvFirst('AGENT_ALLOWED_ORIGINS', 'MANGO_AGENT_ALLOWED_ORIGINS') ||
  'http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002'
)
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o && o !== '*');
const PAIRING_TOKEN =
  getenvFirst('AGENT_PAIRING_TOKEN', 'MANGO_AGENT_PAIRING_TOKEN') ||
  crypto.randomBytes(32).toString('base64url');
function defaultAgentPlatform() {
  const arch = os.arch() === 'arm64' ? 'arm64' : 'x64';
  if (process.platform === 'linux') return `linux-${arch}`;
  if (process.platform === 'darwin') return `darwin-${arch}`;
  return `windows-${arch}`;
}

const PLATFORM = getenvFirst('AGENT_PLATFORM', 'MANGO_AGENT_PLATFORM') || defaultAgentPlatform();
const HOSTNAME =
  getenvFirst('AGENT_HOSTNAME') ||
  os.hostname() ||
  (process.platform === 'linux' ? 'MOCK-LINUX-PC' : 'MOCK-WINDOWS-PC');
const DEVICE_FINGERPRINT =
  getenvFirst('AGENT_DEVICE_FINGERPRINT') ||
  'mock-' + crypto.createHash('sha256').update(HOSTNAME).digest('hex').slice(0, 24);
const START_TIME = Date.now();
const DEFAULT_VERSION = '2.0.0';

function generateX25519PublicKeyB64() {
  const { publicKey } = crypto.generateKeyPairSync('x25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  // Raw 32-byte X25519 public key is the last 32 bytes of SPKI DER
  return spki.subarray(spki.length - 32).toString('base64');
}

function providerDisplayName(provider) {
  if (provider === 'FORTINET') return 'Fortinet SSL-VPN';
  if (provider === 'CISCO') return 'Cisco AnyConnect';
  return 'WireGuard';
}

const userStates = new Map();

function getAgentState(userHint) {
  const key = (userHint || 'default').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'default';
  if (!userStates.has(key)) {
    userStates.set(key, {
      version: DEFAULT_VERSION,
      state: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error'
      providerType: 'WIREGUARD',
      gatewayId: null,
      peerIdentity: null,
      sessionId: null,
      assignedIp: null,
      serverEndpoint: null,
      allowedIps: [],
      publicKey: generateX25519PublicKeyB64(),
      connectedSince: null,
      bytesReceived: 0,
      bytesSent: 0,
      lastError: null,
      deviceFingerprint: null,
    });
  }
  return userStates.get(key);
}

const agentState = getAgentState('default');

setInterval(() => {
  for (const st of userStates.values()) {
    if (st.state === 'connected') {
      st.bytesReceived += Math.floor(Math.random() * 8192) + 1024;
      st.bytesSent += Math.floor(Math.random() * 4096) + 512;
    }
  }
}, 1000).unref();

function isOriginAllowed(origin) {
  return Boolean(origin && ALLOWED_ORIGINS.includes(origin));
}

function setCorsAndPnaHeaders(req, res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Mango-Agent-Token, X-Mango-Dev-User, Access-Control-Request-Private-Network',
  );
  if (
    req.method === 'OPTIONS' ||
    String(req.headers['access-control-request-private-network'] || '').toLowerCase() === 'true'
  ) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function isValidPairingToken(provided) {
  if (!provided || typeof provided !== 'string') return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(PAIRING_TOKEN, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const payload = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendError(res, statusCode, code, message) {
  return sendJson(res, statusCode, {
    success: false,
    error: { code, message },
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!isOriginAllowed(origin)) {
      return sendError(res, 403, 'FORBIDDEN_ORIGIN', 'Origin is not in the agent allowlist');
    }
    setCorsAndPnaHeaders(req, res, origin);
  }

  if (req.method === 'OPTIONS') {
    if (!origin) {
      return sendError(res, 403, 'FORBIDDEN_ORIGIN', 'Origin header is required for preflight');
    }
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/health') {
      const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);
      return sendJson(res, 200, {
        status: 'ok',
        service: 'mango-agent-windows',
        version: agentState.version,
        uptimeSeconds,
        tunnelActive: agentState.state === 'connected',
        supportsDevUserHint: true,
      });
    }

    // All endpoints below require the local pairing token
    if (
      pathname === '/status' ||
      pathname === '/connect' ||
      pathname === '/disconnect'
    ) {
      const tokenHeader = req.headers['x-mango-agent-token'];
      if (!isValidPairingToken(tokenHeader)) {
        return sendError(res, 401, 'INVALID_PAIRING_TOKEN', 'Missing or invalid pairing token');
      }
    }

    if (req.method === 'GET' && pathname === '/status') {
      const userHint = (req.headers['x-mango-dev-user'] || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      const state = getAgentState(userHint);
      return sendJson(res, 200, {
        state: state.state,
        version: state.version,
        publicKey: state.publicKey,
        providerType: state.providerType,
        gatewayId: state.gatewayId,
        peerIdentity: state.peerIdentity,
        sessionId: state.sessionId,
        assignedIp: state.assignedIp,
        serverEndpoint: state.serverEndpoint,
        allowedIps: state.allowedIps,
        connectedSince: state.connectedSince,
        bytesReceived: state.bytesReceived,
        bytesSent: state.bytesSent,
        lastError: state.lastError,
      });
    }

    if (req.method === 'POST' && pathname === '/connect') {
      const body = await parseJsonBody(req);
      const ticket = typeof body.ticket === 'string' ? body.ticket.trim() : '';
      if (!ticket) {
        return sendError(res, 400, 'MISSING_TICKET', 'Connect ticket is required');
      }

      const rawProvider = typeof body.providerType === 'string' ? body.providerType.trim().toUpperCase() : '';
      const requestedProvider = rawProvider || 'WIREGUARD';
      if (!VALID_PROVIDERS.has(requestedProvider)) {
        return sendError(
          res,
          400,
          'UNSUPPORTED_PROVIDER',
          `unsupported providerType ${JSON.stringify(body.providerType)}: must be WIREGUARD, FORTINET, or CISCO`,
        );
      }
      const requestedGatewayId = typeof body.gatewayId === 'string' ? body.gatewayId.trim() : '';

      const origin = req.headers.origin || '';
      let portSuffix = '';
      try {
        if (origin) {
          const u = new URL(origin);
          if (u.port) {
            portSuffix = '-' + u.port;
          }
        }
      } catch {
        // ignore
      }

      // Support user role hint in dev mode to allow multi-user demo on a single link/port
      const userHint = (
        req.headers['x-mango-dev-user'] ||
        body.userHint ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');

      const userSuffix = userHint ? `-${userHint}` : portSuffix;
      const activeFingerprint = DEVICE_FINGERPRINT + userSuffix;
      const activeHostname = HOSTNAME + (userSuffix ? userSuffix : '');
      const agentState = getAgentState(userHint);

      agentState.publicKey = generateX25519PublicKeyB64();
      agentState.providerType = requestedProvider;
      agentState.deviceFingerprint = activeFingerprint;
      agentState.state = 'connecting';
      agentState.lastError = null;

      const connectPayload = {
        ticket,
        deviceFingerprint: activeFingerprint,
        hostname: activeHostname,
        agentVersion: agentState.version,
        platform: PLATFORM,
      };
      if (requestedProvider === 'WIREGUARD') {
        connectPayload.publicKey = agentState.publicKey;
      }
      if (rawProvider) {
        connectPayload.providerType = requestedProvider;
      }
      if (requestedGatewayId) {
        connectPayload.gatewayId = requestedGatewayId;
      }

      let apiRes;
      try {
        apiRes = await fetch(`${API_URL}/api/vpn/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(connectPayload),
        });
      } catch (err) {
        agentState.state = 'error';
        agentState.lastError = `Failed to reach control plane API: ${err.message}`;
        return sendError(res, 502, 'API_UNREACHABLE', agentState.lastError);
      }

      const apiData = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok) {
        agentState.state = 'error';
        agentState.lastError = apiData.message || `Control plane API returned HTTP ${apiRes.status}`;
        return sendError(res, apiRes.status, 'API_CONNECT_REJECTED', agentState.lastError);
      }

      const activeProvider =
        typeof apiData.providerType === 'string' && VALID_PROVIDERS.has(apiData.providerType)
          ? apiData.providerType
          : requestedProvider;
      const activeIdentity = apiData.peerIdentity || agentState.publicKey;

      agentState.state = 'connected';
      agentState.providerType = activeProvider;
      agentState.gatewayId = apiData.gatewayId || null;
      agentState.peerIdentity = activeIdentity;
      agentState.publicKey = activeIdentity;
      agentState.sessionId = apiData.sessionId || null;
      agentState.assignedIp = apiData.assignedIp || null;
      agentState.serverEndpoint = apiData.serverEndpoint || null;
      agentState.allowedIps = Array.isArray(apiData.allowedIps) ? apiData.allowedIps : [];
      agentState.connectedSince = apiData.connectedAt || new Date().toISOString();
      agentState.bytesReceived = 0;
      agentState.bytesSent = 0;
      agentState.lastError = null;

      return sendJson(res, 200, {
        success: true,
        message: `${providerDisplayName(activeProvider)} tunnel connected`,
        state: 'connected',
        providerType: activeProvider,
        gatewayId: agentState.gatewayId,
        peerIdentity: activeIdentity,
        publicKey: activeIdentity,
        sessionId: agentState.sessionId,
        assignedIp: agentState.assignedIp,
        serverEndpoint: agentState.serverEndpoint,
        allowedIps: agentState.allowedIps,
        connectedSince: agentState.connectedSince,
      });
    }

    if (req.method === 'POST' && pathname === '/disconnect') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const userHint = (
        req.headers['x-mango-dev-user'] ||
        body.userHint ||
        ''
      )
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
      const agentState = getAgentState(userHint);
      const prevProvider = agentState.providerType || 'WIREGUARD';
      if (agentState.state === 'connected') {
        try {
          const discPayload = {
            sessionId: agentState.sessionId || undefined,
            publicKey: agentState.peerIdentity || agentState.publicKey,
            deviceFingerprint: agentState.deviceFingerprint || DEVICE_FINGERPRINT,
          };
          if (prevProvider !== 'WIREGUARD') {
            discPayload.providerType = prevProvider;
            discPayload.peerIdentity = agentState.peerIdentity || agentState.publicKey;
          }
          if (agentState.gatewayId) {
            discPayload.gatewayId = agentState.gatewayId;
          }
          await fetch(`${API_URL}/api/vpn/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(discPayload),
          });
        } catch {
          // Best-effort notification when API is unreachable
        }
      }

      agentState.state = 'disconnected';
      agentState.providerType = 'WIREGUARD';
      agentState.gatewayId = null;
      agentState.peerIdentity = null;
      agentState.sessionId = null;
      agentState.assignedIp = null;
      agentState.serverEndpoint = null;
      agentState.allowedIps = [];
      agentState.connectedSince = null;
      agentState.bytesReceived = 0;
      agentState.bytesSent = 0;
      agentState.lastError = null;

      return sendJson(res, 200, {
        success: true,
        message: `${providerDisplayName(prevProvider)} tunnel disconnected`,
        state: 'disconnected',
      });
    }

    return sendError(res, 404, 'NOT_FOUND', `Endpoint ${pathname} not found on local Windows Agent`);
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', err.message || 'Internal Agent Error');
  }
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`
============================================================
  MANGO VPN - Local Endpoint Agent Simulator (v2)
============================================================
  Address:        http://${HOST}:${PORT}
  Platform:       ${PLATFORM}
  Providers:      WIREGUARD, FORTINET, CISCO
  AllowedOrigins: ${ALLOWED_ORIGINS.join(', ')}
  PairingToken:   ${PAIRING_TOKEN}
============================================================
`);
  });
}

module.exports = { server, PAIRING_TOKEN };
