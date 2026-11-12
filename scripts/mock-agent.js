#!/usr/bin/env node

/**
 * MANGO VPN - Local Windows Agent Simulator
 * 
 * Simulates the Go Windows Service (LocalSystem) running on the client machine.
 * Listens on: http://127.0.0.1:47821
 * 
 * Designed for the Junior Developer (Portal Frontend) to develop and test:
 * - Agent installation detection (GET /health)
 * - Private Network Access (PNA) CORS preflights
 * - Tunnel connection orchestration (POST /connect)
 * - Status & telemetry polling (GET /status)
 * - Tunnel disconnection (POST /disconnect)
 * 
 * ZERO external dependencies. Runs directly with Node.js >= 18.
 */

const http = require('http');
const crypto = require('crypto');

const PORT = 47821;
const HOST = '127.0.0.1';
const START_TIME = Date.now();

// In-Memory Simulated State
const agentState = {
  version: '1.0.0-mock',
  state: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error'
  assignedIp: null,
  serverEndpoint: '127.0.0.1:51820',
  publicKey: crypto.randomBytes(32).toString('base64'),
  connectedSince: null,
  bytesReceived: 0,
  bytesSent: 0,
  lastError: null,
};

// Periodic telemetry generator when connected
setInterval(() => {
  if (agentState.state === 'connected') {
    agentState.bytesReceived += Math.floor(Math.random() * 8192) + 1024;
    agentState.bytesSent += Math.floor(Math.random() * 4096) + 512;
  }
}, 1000);

/**
 * Apply CORS and Chromium Private Network Access (PNA) headers
 */
function setCorsAndPnaHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Access-Control-Request-Private-Network');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // CRITICAL for Chromium Private Network Access (PNA) specification:
  // Public/local browser contexts communicating with loopback 127.0.0.1
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

/**
 * Parse incoming JSON body
 */
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
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
      } catch (err) {
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

const server = http.createServer(async (req, res) => {
  setCorsAndPnaHeaders(req, res);

  // Handle CORS & PNA Preflight Requests
  if (req.method === 'OPTIONS') {
    console.log(`[PNA/CORS] Preflight OPTIONS ${req.url} from ${req.headers.origin || 'unknown'}`);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  console.log(`[Agent] ${req.method} ${pathname}`);

  try {
    // ----------------------------------------------------
    // GET /health
    // ----------------------------------------------------
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

    // ----------------------------------------------------
    // GET /status
    // ----------------------------------------------------
    if (req.method === 'GET' && pathname === '/status') {
      return sendJson(res, 200, {
        state: agentState.state,
        assignedIp: agentState.assignedIp,
        serverEndpoint: agentState.serverEndpoint,
        publicKey: agentState.publicKey,
        connectedSince: agentState.connectedSince,
        bytesReceived: agentState.bytesReceived,
        bytesSent: agentState.bytesSent,
        lastError: agentState.lastError,
      });
    }

    // ----------------------------------------------------
    // POST /connect
    // ----------------------------------------------------
    if (req.method === 'POST' && pathname === '/connect') {
      const body = await parseJsonBody(req);
      const accessToken = body.accessToken;

      if (!accessToken) {
        return sendJson(res, 400, {
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'accessToken is required to initiate VPN connection',
          },
        });
      }

      console.log(`[Agent] Received connect request with accessToken: ${accessToken.slice(0, 16)}...`);
      agentState.state = 'connecting';

      // Simulate WireGuard Adapter Key generation & Backend handshake
      setTimeout(() => {
        agentState.state = 'connected';
        agentState.assignedIp = '10.13.13.' + (Math.floor(Math.random() * 200) + 10) + '/32';
        agentState.connectedSince = new Date().toISOString();
        agentState.lastError = null;
        agentState.bytesReceived = 1024;
        agentState.bytesSent = 512;

        console.log(`[Agent] WireGuard tunnel ESTABLISHED!`);
        console.log(`[Agent] Assigned IP: ${agentState.assignedIp}`);
        console.log(`[Agent] Peer Public Key: ${agentState.publicKey}`);
      }, 300);

      return sendJson(res, 200, {
        success: true,
        message: 'WireGuard tunnel connection initiated successfully',
        state: 'connected',
        assignedIp: '10.13.13.45/32', // immediate response for mock
        serverEndpoint: agentState.serverEndpoint,
        connectedSince: new Date().toISOString(),
      });
    }

    // ----------------------------------------------------
    // POST /disconnect
    // ----------------------------------------------------
    if (req.method === 'POST' && pathname === '/disconnect') {
      console.log(`[Agent] Received disconnect request.`);
      agentState.state = 'disconnected';
      const prevIp = agentState.assignedIp;
      agentState.assignedIp = null;
      agentState.connectedSince = null;

      console.log(`[Agent] WireGuard tunnel TEARDOWN completed. (Previous IP was ${prevIp})`);

      return sendJson(res, 200, {
        success: true,
        message: 'WireGuard tunnel closed successfully',
        state: 'disconnected',
      });
    }

    // Not Found
    return sendJson(res, 404, {
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint ${pathname} not found on local Windows Agent`,
      },
    });

  } catch (err) {
    console.error(`[Agent] Error handling request:`, err);
    return sendJson(res, 500, {
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'Internal Agent Error',
      },
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`
============================================================
  MANGO VPN - Local Windows Agent Simulator
============================================================
  Status:  LISTENING
  Address: http://${HOST}:${PORT}
  Service: mango-agent-windows (Mock)
  PNA:     Access-Control-Allow-Private-Network ENABLED

  Endpoints:
    - GET  http://${HOST}:${PORT}/health
    - GET  http://${HOST}:${PORT}/status
    - POST http://${HOST}:${PORT}/connect
    - POST http://${HOST}:${PORT}/disconnect

  Junior Dev instructions:
    Open Portal at http://localhost:3000 to see 'Agent Status: Installed'
============================================================
`);
});

