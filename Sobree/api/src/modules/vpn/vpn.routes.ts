import { FastifyInstance } from 'fastify';
import { VpnController } from './vpn.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

export async function vpnRoutes(app: FastifyInstance) {
  const controller = new VpnController();

  app.post('/api/vpn/connect', { preHandler: [authenticate] }, (req: any, reply) => controller.connect(req, reply));
  app.post('/api/vpn/disconnect', { preHandler: [authenticate] }, (req: any, reply) => controller.disconnect(req, reply));
}
