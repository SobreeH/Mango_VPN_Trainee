import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import {
  LoginRequest,
  LoginResponse,
  VerifyOtpRequest,
  AuthTokenResponse,
  RoleName,
} from '@mango/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'mango-vpn-jwt-insecure-secret-key-32chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '3600s';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'mango-vpn-refresh-token-insecure-secret';

interface OtpChallenge {
  userId: string;
  otpCode: string;
  expiresAt: number;
}

// In-memory challenge store (can be replaced by Redis in distributed cluster)
const challengeStore = new Map<string, OtpChallenge>();

export class AuthService {
  /**
   * Step 1: Validate username & password, issue OTP challenge
   */
  async login(body: LoginRequest, clientIp: string): Promise<LoginResponse> {
    const user = await prisma.user.findUnique({
      where: { username: body.username },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid credentials or inactive account');
    }

    const isValidPassword = await bcrypt.compare(body.password, user.passwordHash);
    if (!isValidPassword) {
      // Record failed audit log
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          ipAddress: clientIp,
          metadataJson: { reason: 'Incorrect password' },
        },
      });
      throw new Error('Invalid credentials or inactive account');
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const challengeId = crypto.randomUUID();
    const expiresInSeconds = 300; // 5 minutes

    challengeStore.set(challengeId, {
      userId: user.id,
      otpCode,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    // In local/dev environment, log the OTP for fast developer testing
    console.log(`\n==================================================`);
    console.log(`[AUTH MFA] OTP Generated for User: ${user.username}`);
    console.log(`[AUTH MFA] Challenge ID: ${challengeId}`);
    console.log(`[AUTH MFA] 6-Digit OTP:  >>>>> ${otpCode} <<<<<`);
    console.log(`==================================================\n`);

    // Mask phone number: e.g. +15551234567 -> +1555****567
    const phone = user.phoneNumber;
    const maskedPhone = phone.length > 7
      ? `${phone.slice(0, 5)}****${phone.slice(-3)}`
      : phone;

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AUTH_MFA_CHALLENGE_ISSUED',
        ipAddress: clientIp,
        metadataJson: { challengeId },
      },
    });

    return {
      requiresOtp: true,
      challengeId,
      maskedPhoneNumber: maskedPhone,
      expiresInSeconds,
      message: `MFA verification code sent to ${maskedPhone}`,
    };
  }

  /**
   * Step 3 & 4: Verify OTP code and issue JWT tokens
   */
  async verifyOtp(body: VerifyOtpRequest, clientIp: string): Promise<AuthTokenResponse> {
    const challenge = challengeStore.get(body.challengeId);
    if (!challenge) {
      throw new Error('MFA challenge not found or expired');
    }

    if (Date.now() > challenge.expiresAt) {
      challengeStore.delete(body.challengeId);
      throw new Error('MFA challenge has expired. Please log in again.');
    }

    if (challenge.otpCode !== body.otpCode.trim()) {
      throw new Error('Invalid 6-digit verification code');
    }

    // OTP Verified - consume challenge
    challengeStore.delete(body.challengeId);

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or account is disabled');
    }

    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role.name as RoleName,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'AUTH_MFA_VERIFIED_SUCCESS',
        ipAddress: clientIp,
        metadataJson: { role: user.role.name },
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        username: user.username,
        phoneNumber: user.phoneNumber,
        role: user.role.name as RoleName,
      },
    };
  }
}
