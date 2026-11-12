import { FastifyRequest, FastifyReply } from 'fastify';
import { VpnService } from './vpn.service.js';
import { VpnConnectRequest, VpnDisconnectRequest } from '@mango/shared';

const vpnService = new VpnService();

export class VpnController {
  async connect(request: FastifyRequest<{ Body: VpnConnectRequest }>, reply: FastifyReply) {
    try {
      const userId = request.user?.userId;
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const clientIp = request.ip || '127.0.0.1';
      const result = await vpnService.connect(userId, request.body, clientIp);

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'VPN_CONNECTION_ERROR',
          message: err.message || 'Failed to establish VPN connection',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async disconnect(request: FastifyRequest<{ Body: VpnDisconnectRequest }>, reply: FastifyReply) {
    try {
      const userId = request.user?.userId;
      if (!userId) {
        return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      }

      const clientIp = request.ip || '127.0.0.1';
      const result = await vpnService.disconnect(userId, request.body, clientIp);

      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: {
          code: 'VPN_DISCONNECT_ERROR',
          message: err.message || 'Failed to disconnect VPN',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
