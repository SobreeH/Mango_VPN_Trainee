#!/usr/bin/env node

/**
 * MANGO VPN - Local Windows Agent Simulator
 *
 * Mirrors Sobree/agent-windows/main.go on http://127.0.0.1:47821:
 * - Strict Origin allowlist (never wildcard or unconditional reflection)
 * - Chromium Private Network Access (PNA) preflight headers
 * - Local pairing token (X-Mango-Agent-Token) on /status, /connect, /disconnect
 * - In-memory X25519 (Curve25519) keypair generation
 * - Connect Ticket contract on POST /connect ({ ticket })
 *
 * ZERO external dependencies. Runs directly with Node.js >= 18.
 */

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.AGENT_PORT || 47821);
const HOST = process.env.AGENT_HOST || '127.0.0.1';
const ALLOWED_ORIGINS = (process.env.AGENT_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o && o !== '*');
const PAIRING_TOKEN = process.env.AGENT_PAIRING_TOKEN || crypto.randomBytes(32).toString('base64url');
const START_TIME = Date.now();

function generateX25519PublicKeyB64() {
  const { publicKey } = crypto.generateKeyPairSync('x25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  // Raw 32-byte X25519 public key is the last 32 bytes of SPKI DER
  return spki.subarray(spki.length - 32).toString('base64');
}

const agentState = {
  version: '2.0.0-mock',
  state: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error'
  assignedIp: null,
  serverEndpoint: '127.0.0.1:51820',
  publicKey: generateX25519PublicKeyB64(),
  connectedSince: null,
  bytesReceived: 0,
  bytesSent: 0,
  lastError: null,
};

setInterval(() => {
  if (agentState.state === 'connected') {
    agentState.bytesReceived += Math.floor(Math.random() * 8192) + 1024;
    agentState.bytesSent += Math.floor(Math.random() * 4096) + 512;
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
    'Content-Type, X-Mango-Agent-Token, Access-Control-Request-Private-Network',
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
      return sendJson(res, 200, {
        state: agentState.state,
        version: agentState.version,
        publicKey: agentState.publicKey,
        assignedIp: agentState.assignedIp,
        serverEndpoint: agentState.serverEndpoint,
        connectedSince: agentState.connectedSince,
        bytesReceived: agentState.bytesReceived,
        bytesSent: agentState.bytesSent,
        lastError: agentState.lastError,
      });
    }

    if (req.method === 'POST' && pathname === '/connect') {
      const body = await parseJsonBody(req);
      const ticket = typeof body.ticket === 'string' ? body.ticket.trim() : '';
      if (!ticket) {
        return sendError(res, 400, 'MISSING_TICKET', 'Connect ticket is required');
      }

      agentState.publicKey = generateX25519PublicKeyB64();
      agentState.state = 'connecting';
      agentState.lastError = null;

      setTimeout(() => {
        agentState.state = 'connected';
        agentState.assignedIp = '10.13.13.' + (Math.floor(Math.random() * 200) + 10) + '/32';
        agentState.connectedSince = new Date().toISOString();
        agentState.bytesReceived = 1024;
        agentState.bytesSent = 512;
      }, 300).unref();

      return sendJson(res, 200, {
        success: true,
        message: 'Curve25519 keypair generated and Connect Ticket accepted',
        state: 'connecting',
        publicKey: agentState.publicKey,
        assignedIp: agentState.assignedIp,
        serverEndpoint: agentState.serverEndpoint,
        connectedSince: agentState.connectedSince,
      });
    }

    if (req.method === 'POST' && pathname === '/disconnect') {
      agentState.state = 'disconnected';
      agentState.assignedIp = null;
      agentState.connectedSince = null;
      agentState.bytesReceived = 0;
      agentState.bytesSent = 0;

      return sendJson(res, 200, {
        success: true,
        message: 'WireGuard tunnel disconnected',
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
  MANGO VPN - Local Windows Agent Simulator (v2)
============================================================
  Address:        http://${HOST}:${PORT}
  AllowedOrigins: ${ALLOWED_ORIGINS.join(', ')}
  PairingToken:   ${PAIRING_TOKEN}
============================================================
`);
  });
}

module.exports = { server, PAIRING_TOKEN };
