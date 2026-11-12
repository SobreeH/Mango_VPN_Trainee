import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './modules/auth/auth.routes.js';
import { vpnRoutes } from './modules/vpn/vpn.routes.js';
import { adminRoutes } from '@mango/rain-admin';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Enable CORS for Portal UI
  await app.register(cors, {
    origin: true, // Allow all origins in dev, or configure allowed origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Root healthcheck
  app.get('/health', async () => ({
    status: 'ok',
    service: 'mango-vpn-api',
    timestamp: new Date().toISOString(),
  }));

  // Register Modules
  await app.register(authRoutes);
  await app.register(vpnRoutes);
  await app.register(adminRoutes);

  // Graceful shutdown handling
  const closeSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, closing server gracefully...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`
============================================================
  MANGO VPN Management API
============================================================
  Status:  READY
  Address: http://${HOST}:${PORT}
  Docs / Endpoints:
    - POST /api/auth/login
    - POST /api/auth/verify-otp
    - POST /api/vpn/connect
    - POST /api/vpn/disconnect
    - GET  /api/devices
    - GET  /api/sessions
    - GET  /api/audit-logs
    - GET  /api/agent-versions
============================================================
`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
