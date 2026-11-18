import { FastifyRequest, FastifyReply } from 'fastify';
import { AdminService, CreateUserDto, CreatePolicyDto } from './admin.service.js';

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

  async getUsers(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const users = await adminService.getUsers();
      return reply.status(200).send({
        success: true,
        data: users,
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

  async getPolicies(request: FastifyRequest, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const policies = await adminService.getPolicies();
      return reply.status(200).send({
        success: true,
        data: policies,
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

  async deleteDevice(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const { id } = request.params;
      await adminService.revokeDevice(id);
      return reply.status(200).send({
        success: true,
        message: 'Device revoked successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(err.message === 'Device not found' ? 404 : 500).send({
        success: false,
        error: { code: err.message === 'Device not found' ? 'NOT_FOUND' : 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async createUser(request: FastifyRequest<{ Body: CreateUserDto }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const body = request.body;
      if (!body?.username || !body?.phoneNumber || !body?.roleName) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required user fields' },
          timestamp: new Date().toISOString(),
        });
      }

      const newUser = await adminService.createUser(body);
      return reply.status(201).send({
        success: true,
        data: newUser,
        message: 'User created successfully',
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

  async createPolicy(request: FastifyRequest<{ Body: CreatePolicyDto }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const body = request.body;
      if (!body?.roleName || !body?.destinationCidr) {
        return reply.status(400).send({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing required policy fields' },
          timestamp: new Date().toISOString(),
        });
      }

      const newPolicy = await adminService.createPolicy(body);
      return reply.status(201).send({
        success: true,
        data: newPolicy,
        message: 'Policy created successfully',
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

  async updatePolicy(
    request: FastifyRequest<{ Params: { id: string }; Body: Partial<CreatePolicyDto> }>,
    reply: FastifyReply
  ) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const { id } = request.params;
      const body = request.body;
      const updated = await adminService.updatePolicy(id, body, user.userId);
      return reply.status(200).send({
        success: true,
        data: updated,
        message: 'Policy updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(err.message === 'Policy not found' ? 404 : 500).send({
        success: false,
        error: { code: err.message === 'Policy not found' ? 'NOT_FOUND' : 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deletePolicy(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const { id } = request.params;
      await adminService.deletePolicy(id);
      return reply.status(200).send({
        success: true,
        message: 'Policy deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(err.message === 'Policy not found' ? 404 : 500).send({
        success: false,
        error: { code: err.message === 'Policy not found' ? 'NOT_FOUND' : 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async disconnectSession(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const { id } = request.params;
      await adminService.disconnectSession(id, user.userId);
      return reply.status(200).send({
        success: true,
        message: 'Session disconnected successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(err.message === 'Session not found' ? 404 : 500).send({
        success: false,
        error: { code: err.message === 'Session not found' ? 'NOT_FOUND' : 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async toggleUserStatus(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const { id } = request.params;
      const updatedUser = await adminService.toggleUserStatus(id, user.userId);
      return reply.status(200).send({
        success: true,
        data: updatedUser,
        message: 'User status updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(err.message === 'User not found' ? 404 : 500).send({
        success: false,
        error: { code: err.message === 'User not found' ? 'NOT_FOUND' : 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async deleteUser(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    try {
      const user = (request as any).user;
      if (user?.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      }

      const { id } = request.params;
      await adminService.deleteUser(id, user.userId);
      return reply.status(200).send({
        success: true,
        message: 'User deleted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(err.message === 'User not found' ? 404 : 500).send({
        success: false,
        error: { code: err.message === 'User not found' ? 'NOT_FOUND' : 'SERVER_ERROR', message: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

