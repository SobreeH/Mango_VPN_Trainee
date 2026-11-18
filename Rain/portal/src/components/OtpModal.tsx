import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, RefreshCw, AlertCircle } from 'lucide-react';
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
// 2. Component OtpModal (ถอดแบบเป๊ะๆ ตาม Mobile UI 6 ช่องกรอกแยก)
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

  // ตัวนับเวลาถอยหลัง (นับถอยหลังเริ่มต้นที่ 4 นาที 32 วินาที = 272 วินาที ตามภาพเป๊ะๆ)
  const [timerSeconds, setTimerSeconds] = useState(272);

  // Array เก็บ Ref ของทั้ง 6 ช่อง
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // นับเวลาถอยหลัง 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // แปลงวินาทีเป็นรูปแบบ M:SS เช่น 4:32
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // จัดการการพิมพ์ในแต่ละช่อง
  const handleDigitChange = (index: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, '');
    if (!cleanDigit) {
      // ถ้าลบตัวเลขในช่องนี้
      const otpArr = otpCode.split('');
      otpArr[index] = '';
      setOtpCode(otpArr.join(''));
      return;
    }

    // เอาตัวเลขตัวสุดท้ายที่พิมพ์
    const char = cleanDigit.slice(-1);
    const otpArr = (otpCode + '      ').slice(0, 6).split('');
    otpArr[index] = char;
    const nextOtp = otpArr.join('').trimEnd();
    setOtpCode(nextOtp);
    setError(null);

    // ย้ายเคอร์เซอร์ไปช่องถัดไปอัตโนมัติ
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // จัดการปุ่มกด Backspace และลูกศร
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpCode[index] && index > 0) {
        // ถ้าช่องปัจจุบันว่างอยู่แล้ว ให้ถอยกลับไปลบช่องก่อนหน้า
        e.preventDefault();
        const otpArr = otpCode.split('');
        otpArr[index - 1] = '';
        setOtpCode(otpArr.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // จัดการการกด Paste ก๊อปปี้ OTP 6 ตัวมาวาง
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasteData) {
      setOtpCode(pasteData);
      setError(null);
      const targetIndex = Math.min(pasteData.length, 5);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  // ดักจับตอนส่งฟอร์ม
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = otpSchema.safeParse({ otpCode });
    if (!validationResult.success) {
      setError(validationResult.error.issues[0]?.message || 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }

    setError(null);
    onVerify(e);
  };

  return (
    <div className="w-full flex flex-col justify-between min-h-[560px] select-none">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* 1. ส่วนหัว: ปุ่มย้อนกลับ และขั้นตอนที่ 2 จาก 3 */}
        <div className="flex items-center space-x-2 -ml-1">
          <button
            type="button"
            onClick={onBack}
            className="p-1 text-slate-300 hover:text-white transition cursor-pointer"
            title="ย้อนกลับ"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs text-slate-400 font-medium">
            ขั้นตอนที่ 2 จาก 3
          </span>
        </div>

        {/* 2. แถบความคืบหน้า 3 ท่อน (Step 2: สองท่อนแรกสีเขียว) */}
        <div className="flex space-x-2">
          <div className="h-1 bg-emerald-500 rounded-full flex-1" />
          <div className="h-1 bg-emerald-500 rounded-full flex-1" />
          <div className="h-1 bg-slate-800/80 rounded-full flex-1" />
        </div>

        {/* 3. หัวข้อและเบอร์โทรศัพท์ */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ยืนยันตัวตน
          </h1>
          <p className="text-xs text-slate-400">
            ส่งรหัส 6 หลักไปที่{' '}
            <span className="font-mono text-slate-300 font-medium">
              {maskedPhoneNumber || '•••-•••-4821'}
            </span>
          </p>
        </div>

        {/* 4. ช่องกรอกรหัส 6 ช่องแยกกัน (Individual 6-Digit Boxes) */}
        <div className="pt-2">
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const char = otpCode[idx] || '';
              return (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={char}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={handlePaste}
                  autoFocus={idx === 0}
                  className={`w-full h-14 sm:h-16 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl bg-[#070e0a] border transition focus:outline-none ${
                    char
                      ? 'border-slate-700 text-white shadow-sm'
                      : 'border-slate-800/90 text-slate-600'
                  } focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40`}
                />
              );
            })}
          </div>

          {/* ข้อความ Error สีแดง */}
          {error && (
            <p className="text-xs text-rose-400 mt-2 flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}

          {/* 5. ตัวนับเวลารหัสหมดอายุ + ปุ่มลัดเติม 123456 */}
          <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-1">
            <div>
              รหัสหมดอายุใน{' '}
              <span className="text-white font-mono font-semibold">
                {formatTime(timerSeconds)}
              </span>{' '}
              นาที
            </div>

            <button
              type="button"
              onClick={() => {
                setOtpCode('123456');
                setError(null);
                inputRefs.current[5]?.focus();
              }}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-mono transition cursor-pointer"
            >
              ⚡ Auto-fill: 123456
            </button>
          </div>
        </div>

        {/* 6. ปุ่มกดยืนยัน (ถ้าไม่ครบ 6 หลัก ปุ่มจะทึบและกดไม่ได้) */}
        <div className="pt-8">
          <button
            type="submit"
            disabled={loading || otpCode.length < 6}
            className={`w-full py-3.5 px-4 font-bold rounded-xl text-sm transition flex items-center justify-center space-x-2 ${
              otpCode.length === 6 && !loading
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-950/40'
                : 'bg-[#101b14] text-slate-500/80 border border-slate-800/60 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <span>ยืนยัน</span>
            )}
          </button>
        </div>
      </form>

      {/* 7. ลิงก์ด้านล่างสุด: รหัสหมดอายุ? เข้าสู่ระบบใหม่ */}
      <div className="text-center pt-8 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
        >
          รหัสหมดอายุ? เข้าสู่ระบบใหม่
        </button>
      </div>
    </div>
  );
};
