import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller.js';

export async function authRoutes(app: FastifyInstance) {
  const controller = new AuthController();

  app.post('/api/auth/login', (req: any, reply) => controller.login(req, reply));
  app.post('/api/auth/verify-otp', (req: any, reply) => controller.verifyOtp(req, reply));
}
