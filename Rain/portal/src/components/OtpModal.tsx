import React, { useState } from 'react';
import { Shield, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
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
// 2. Component OtpModal (ขั้นตอนที่ 2 จาก 3: ยืนยันรหัส OTP)
// =========================================================================
export const OtpModal: React.FC<OtpModalProps> = ({
  maskedPhoneNumber,
  otpCode,
  setOtpCode,
  loading,
  onVerify,
  onBack,
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = otpSchema.safeParse({ otpCode });

    if (!validationResult.success) {
      setError(validationResult.error.issues[0]?.message || 'รหัส OTP ไม่ถูกต้อง');
      return;
    }

    setError(null);
    onVerify(e);
  };

  return (
    <div className="w-full flex flex-col justify-between min-h-[560px] select-none">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* 1. ส่วนหัว: โลโก้ MANGO VPN */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <Shield className="w-5 h-5 fill-white/20" />
          </div>
          <span className="text-lg font-bold text-white tracking-wider">
            MANGO VPN
          </span>
        </div>

        {/* 2. หัวข้อฟอร์ม และ Step Progress Bar (ขั้นตอนที่ 2 จาก 3) */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono tracking-widest text-emerald-400 font-semibold uppercase">
            SECURE CHANNEL · 2FA VERIFICATION
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ยืนยันรหัส OTP
          </h1>
          <p className="text-xs text-slate-400">
            ขั้นตอนที่ 2 จาก 3 · กรอกรหัส 6 หลักที่ส่งไปยัง{' '}
            <span className="text-emerald-400 font-mono font-semibold">
              {maskedPhoneNumber}
            </span>
          </p>

          {/* แถบความคืบหน้า 3 ท่อน (Step 2: สองท่อนแรกสีเขียว) */}
          <div className="flex space-x-2 pt-2">
            <div className="h-1 bg-emerald-500 rounded-full flex-1" />
            <div className="h-1 bg-emerald-500 rounded-full flex-1" />
            <div className="h-1 bg-slate-800/80 rounded-full flex-1" />
          </div>
        </div>

        {/* 3. ช่องกรอกรหัส OTP */}
        <div className="pt-2">
          <label className="block text-xs font-medium text-slate-200 mb-2 text-center">
            Verification Code (6 Digits)
          </label>
          <input
            type="text"
            maxLength={6}
            value={otpCode}
            onChange={(e) => {
              setOtpCode(e.target.value.replace(/\D/g, ''));
              if (error) setError(null);
            }}
            placeholder="••••••"
            autoFocus
            className={`w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 bg-[#070e0a] border rounded-xl text-emerald-400 placeholder-slate-700 focus:outline-none transition shadow-inner ${
              error
                ? 'border-rose-500 focus:border-rose-500'
                : 'border-slate-800 focus:border-emerald-500'
            }`}
          />

          {/* ข้อความ Error สีแดง หรือปุ่มกด Auto-fill */}
          {error ? (
            <p className="text-xs text-rose-400 mt-2 flex items-center justify-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          ) : (
            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={() => {
                  setOtpCode('123456');
                  setError(null);
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 px-3 py-1 rounded-lg border border-emerald-800/60 font-mono transition cursor-pointer flex items-center space-x-1.5"
              >
                <span>⚡ Auto-fill Demo OTP:</span>
                <strong className="underline">123456</strong>
              </button>
            </div>
          )}
        </div>

        {/* 4. ปุ่มยืนยัน OTP */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={loading || otpCode.length < 6}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>ยืนยันรหัส OTP</span>
            )}
          </button>
        </div>
      </form>

      {/* 5. ปุ่มย้อนกลับ */}
      <div className="text-center pt-8 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer inline-flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>ย้อนกลับไปหน้าเข้าสู่ระบบ</span>
        </button>
      </div>
    </div>
  );
};
