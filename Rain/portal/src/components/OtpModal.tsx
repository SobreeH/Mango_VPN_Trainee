import React, { useState } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { otpSchema } from '../schemas/auth.schema';

// =========================================================================
// 1. Props Interface
// =========================================================================
interface OtpModalProps {
  maskedPhoneNumber: string;
  otpCode: string;
  setOtpCode: (value: string) => void;
  loading: boolean;
  onVerify: (e: React.FormEvent) => void;
  onBack: () => void;
}

// =========================================================================
// 2. Component OtpModal พร้อมระบบตรวจสอบด้วย Zod
// =========================================================================
export const OtpModal: React.FC<OtpModalProps> = ({
  maskedPhoneNumber,
  otpCode,
  setOtpCode,
  loading,
  onVerify,
  onBack,
}) => {
  // สถานะเก็บข้อความผิดพลาดของ OTP
  const [error, setError] = useState<string | null>(null);

  // ฟังก์ชันตรวจสอบก่อนส่ง OTP ไปยืนยัน
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. ตรวจสอบด้วย Zod Schema
    const validationResult = otpSchema.safeParse({ otpCode });

    // 2. ถ้าไม่ถูกต้อง (เช่น ยาวไม่ถึง 6 ตัว)
    if (!validationResult.success) {
      setError(validationResult.error.issues[0]?.message || 'รหัส OTP ไม่ถูกต้อง');
      return;
    }

    // 3. ถ้าถูกต้อง: เคลียร์ Error แล้วเรียก onVerify
    setError(null);
    onVerify(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* หัวข้อโมดอล */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Two-Factor Authentication
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Enter the 6-digit verification code sent to{' '}
          <span className="text-amber-400 font-mono font-semibold">
            {maskedPhoneNumber}
          </span>
        </p>
      </div>

      {/* ช่องกรอก OTP ขนาดใหญ่แบบ monospace */}
      <div className="py-2">
        <label className="block text-xs font-medium text-slate-300 mb-2 text-center">
          Verification Code
        </label>
        <input
          type="text"
          maxLength={6}
          value={otpCode}
          onChange={(e) => {
            // กรองเฉพาะตัวเลข
            setOtpCode(e.target.value.replace(/\D/g, ''));
            // ลบ Error ทันทีเมื่อผู้ใช้พิมพ์แก้ไข
            if (error) setError(null);
          }}
          placeholder="123456"
          autoFocus
          className={`w-full text-center tracking-[0.5em] text-2xl font-mono py-3 bg-slate-950 border rounded-lg text-amber-400 placeholder-slate-700 focus:outline-none transition shadow-inner ${
            error
              ? 'border-rose-500 focus:border-rose-500' // กรอบแดงเมื่อมี Error
              : 'border-slate-700 focus:border-amber-500'
          }`}
        />

        {/* ข้อความ Error สีแดงใต้ช่องกรอก */}
        {error ? (
          <p className="text-xs text-rose-400 mt-2 flex items-center justify-center space-x-1 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : (
          <p className="text-[11px] text-slate-500 text-center mt-2">
            (In dev mode, check backend API terminal logs for generated OTP)
          </p>
        )}
      </div>

      {/* ปุ่มกด 2 ปุ่ม: Back และ Verify */}
      <div className="flex space-x-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="w-1/3 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
        >
          Back
        </button>

        <button
          type="submit"
          disabled={loading || otpCode.length < 6}
          className="w-2/3 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition disabled:opacity-50 flex items-center justify-center space-x-1 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-amber-500/20"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <span>Verify OTP</span>
          )}
        </button>
      </div>
    </form>
  );
};
