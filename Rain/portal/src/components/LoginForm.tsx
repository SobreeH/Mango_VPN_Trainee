import React, { useState } from 'react';
import { User as UserIcon, Lock, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { loginSchema } from '../schemas/auth.schema';

// =========================================================================
// 1. Props Interface
// =========================================================================
interface LoginFormProps {
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

// =========================================================================
// 2. Component LoginForm พร้อมระบบตรวจสอบความถูกต้องด้วย Zod
// =========================================================================
export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  loading,
  onSubmit,
}) => {
  // เก็บข้อความ Error ของแต่ละช่อง เช่น { username: 'กรุณากรอก Username' }
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});

  // ฟังก์ชันดักจับตอนกดปุ่ม Submit เพื่อตรวจฟอร์มด้วย Zod ก่อนส่งต่อ
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. ใช้ Zod ตรวจสอบข้อมูลในฟอร์ม
    const validationResult = loginSchema.safeParse({ username, password });

    // 2. ถ้าไม่ผ่านเกณฑ์
    if (!validationResult.success) {
      const fieldErrors: { username?: string; password?: string } = {};
      
      // ดึงข้อความ Error ของแต่ละช่องออกมาจาก issues
      validationResult.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as 'username' | 'password';
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      });

      setErrors(fieldErrors);
      return; // สั่งหยุด ไม่ส่งต่อไปยัง Backend API!
    }

    // 3. ถ้าผ่านเกณฑ์ฉลุย: เคลียร์ Error เดิมทิ้ง แล้วเรียก onSubmit ของจริง
    setErrors({});
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* หัวข้อฟอร์ม */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Sign in to VPN</h2>
        <p className="text-xs text-slate-400 mt-1">
          Enter corporate credentials to authenticate with MANGO VPN gateway.
        </p>
      </div>

      {/* ช่องกรอกข้อมูล (Inputs) */}
      <div className="space-y-3 pt-2">
        
        {/* ช่องที่ 1: Username */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Username
          </label>
          <div className="relative">
            <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                // เมื่อเริ่มพิมพ์ ให้ลบ Error เก่าออกทันที
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              placeholder="your.username"
              className={`w-full pl-9 pr-3 py-2 bg-slate-950 border rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition ${
                errors.username
                  ? 'border-rose-500 focus:border-rose-500' // สลับกรอบสีแดงเมื่อมี Error
                  : 'border-slate-800 focus:border-amber-500'
              }`}
            />
          </div>
          {/* ข้อความแจ้งเตือนสีแดงใต้ช่อง Username */}
          {errors.username && (
            <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.username}</span>
            </p>
          )}
        </div>

        {/* ช่องที่ 2: Password */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                // เมื่อเริ่มพิมพ์ ให้ลบ Error เก่าออกทันที
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="••••••••••••"
              className={`w-full pl-9 pr-3 py-2 bg-slate-950 border rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition ${
                errors.password
                  ? 'border-rose-500 focus:border-rose-500' // สลับกรอบสีแดงเมื่อมี Error
                  : 'border-slate-800 focus:border-amber-500'
              }`}
            />
          </div>
          {/* ข้อความแจ้งเตือนสีแดงใต้ช่อง Password */}
          {errors.password && (
            <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.password}</span>
            </p>
          )}
        </div>
      </div>

      {/* ปุ่มกด Continue to MFA */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold rounded-lg text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Continue to MFA</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* กล่องแสดงบัญชีสำหรับทดสอบ */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
        <span className="font-semibold text-slate-300 block">Default Demo Credentials:</span>
        <div>• Admin: <code className="text-amber-400">admin_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
        <div>• Staff: <code className="text-amber-400">staff_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
        <div>• Client: <code className="text-amber-400">client_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
      </div>
    </form>
  );
};
