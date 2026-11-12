import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { LoginRequest, VerifyOtpRequest } from '@mango/shared';

const authService = new AuthService();

export class AuthController {
  async login(request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) {
    try {
      const clientIp = request.ip || '127.0.0.1';
      const result = await authService.login(request.body, clientIp);
      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: err.message || 'Authentication failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async verifyOtp(request: FastifyRequest<{ Body: VerifyOtpRequest }>, reply: FastifyReply) {
    try {
      const clientIp = request.ip || '127.0.0.1';
      const result = await authService.verifyOtp(request.body, clientIp);
      return reply.status(200).send({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: {
          code: 'OTP_VERIFICATION_FAILED',
          message: err.message || 'OTP verification failed',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}
