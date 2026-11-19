import { z } from 'zod';
import { Translations, translations } from '../i18n/translations';

// =========================================================================
// 1. แม่พิมพ์สำหรับตรวจสอบฟอร์ม Login (Username & Password)
// =========================================================================
export function createLoginSchema(messages: Translations['validation']) {
  return z.object({
    username: z
      .string()
      .trim()
      .min(1, messages.usernameRequired)
      .max(50, messages.usernameMax)
      .regex(/^[a-zA-Z0-9_.-]+$/, messages.usernameRegex),

    password: z
      .string()
      .min(1, messages.passwordRequired)
      .min(6, messages.passwordMin),
  });
}

export const loginSchema = createLoginSchema(translations.th.validation);

// ดึง Type ออกมาจากแม่พิมพ์โดยอัตโนมัติ (ไม่ต้องเขียน interface ซ้ำ!)
export type LoginFormData = z.infer<typeof loginSchema>;

// =========================================================================
// 2. แม่พิมพ์สำหรับตรวจสอบรหัส 2FA OTP (6 ตัวเลข)
// =========================================================================
export function createOtpSchema(messages: Translations['validation']) {
  return z.object({
    otpCode: z
      .string()
      .length(6, messages.otpLength)
      .regex(/^\d{6}$/, messages.otpDigits),
  });
}

export const otpSchema = createOtpSchema(translations.th.validation);

export type OtpFormData = z.infer<typeof otpSchema>;
