import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller.js';

export async function adminRoutes(app: FastifyInstance) {
  const controller = new AdminController();

  app.get('/api/devices', (req, reply) => controller.getDevices(req, reply));
  app.get('/api/sessions', (req, reply) => controller.getSessions(req, reply));
  app.get('/api/audit-logs', (req, reply) => controller.getAuditLogs(req, reply));
  app.get('/api/agent-versions', (req, reply) => controller.getAgentVersions(req, reply));
}

