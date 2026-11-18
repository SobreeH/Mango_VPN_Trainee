import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller.js';

export async function adminRoutes(app: FastifyInstance) {
  const controller = new AdminController();

  app.get('/api/devices', (req, reply) => controller.getDevices(req, reply));
  app.get('/api/sessions', (req, reply) => controller.getSessions(req, reply));
  app.get('/api/audit-logs', (req, reply) => controller.getAuditLogs(req, reply));
  app.get('/api/agent-versions', (req, reply) => controller.getAgentVersions(req, reply));
  app.get('/api/users', (req, reply) => controller.getUsers(req, reply));
  app.post('/api/users', (req, reply) => controller.createUser(req as any, reply));
  app.get('/api/policies', (req, reply) => controller.getPolicies(req, reply));
  app.post('/api/policies', (req, reply) => controller.createPolicy(req as any, reply));
  app.put('/api/policies/:id', (req, reply) => controller.updatePolicy(req as any, reply));
  app.delete('/api/policies/:id', (req, reply) => controller.deletePolicy(req as any, reply));
  app.delete('/api/devices/:id', (req, reply) => controller.deleteDevice(req as any, reply));
  app.post('/api/sessions/:id/disconnect', (req, reply) => controller.disconnectSession(req as any, reply));
  app.patch('/api/users/:id/status', (req, reply) => controller.toggleUserStatus(req as any, reply));
  app.delete('/api/users/:id', (req, reply) => controller.deleteUser(req as any, reply));
}

