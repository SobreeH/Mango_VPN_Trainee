import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService } from './admin.service.js';

const adminService = new AdminService();

export class AdminController {
  async getDevices(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user?.userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const devices = await adminService.getDevices(user.userId, user.role === 'ADMIN');
      return reply.status(200).send({
        success: true,
        data: devices,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getSessions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (!user?.userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }

      const sessions = await adminService.getSessions(user.userId, user.role === 'ADMIN');
      return reply.status(200).send({
        success: true,
        data: sessions,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAuditLogs(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const logs = await adminService.getAuditLogs();
      return reply.status(200).send({
        success: true,
        data: logs,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getAgentVersions(_request: FastifyRequest, reply: FastifyReply) {
    try {
      const versions = await adminService.getAgentVersions();
      return reply.status(200).send({
        success: true,
        data: versions,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: { code: 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

