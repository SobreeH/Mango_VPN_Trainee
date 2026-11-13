import React from 'react';
import { RefreshCw } from 'lucide-react';

// =========================================================================
// 1. Props Interface: กำหนดค่าที่โมดอล OTP ต้องการ
// =========================================================================
interface OtpModalProps {
  maskedPhoneNumber: string;                    // เบอร์โทรศัพท์ที่ถูกเซนเซอร์ เช่น "+1555****567"
  otpCode: string;                              // ค่ารหัส OTP 6 หลักที่พิมพ์
  setOtpCode: (value: string) => void;          // ฟังก์ชันอัปเดตรหัส OTP
  loading: boolean;                             // สถานะกำลังติดต่อ API
  onVerify: (e: React.FormEvent) => void;       // ฟังก์ชันกดยืนยัน OTP
  onBack: () => void;                           // ฟังก์ชันกดย้อนกลับไปหน้าล็อกอิน
}

// =========================================================================
// 2. Component OtpModal: หน้าต่างยืนยันรหัส 2FA OTP
// =========================================================================
export const OtpModal: React.FC<OtpModalProps> = ({
  maskedPhoneNumber,
  otpCode,
  setOtpCode,
  loading,
  onVerify,
  onBack,
}) => {
  return (
    <form onSubmit={onVerify} className="space-y-4">
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
          /* ดักจับเฉพาะตัวเลข 0-9 เท่านั้น ตัดตัวอักษรอื่นทิ้งทันที */
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          autoFocus
          required
          className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3 bg-slate-950 border border-slate-700 rounded-lg text-amber-400 placeholder-slate-700 focus:outline-none focus:border-amber-500 transition shadow-inner"
        />
        <p className="text-[11px] text-slate-500 text-center mt-2">
          (In dev mode, check backend API terminal logs for generated OTP)
        </p>
      </div>

      {/* ปุ่มกด 2 ปุ่ม: ย้อนกลับ (Back) และ ยืนยัน (Verify OTP) */}
      <div className="flex space-x-3 pt-2">
        {/* ปุ่ม Back */}
        <button
          type="button"
          onClick={onBack}
          className="w-1/3 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
        >
          Back
        </button>

        {/* ปุ่ม Verify OTP */}
        <button
          type="submit"
          /* ปิดปุ่มถ้ากำลังโหลด หรือพิมพ์ยังไม่ครบ 6 ตัว */
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
