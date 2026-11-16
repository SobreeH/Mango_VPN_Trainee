import React, { useState } from 'react';
import {
  User as UserIcon,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  UserCheck,
  Crown,
} from 'lucide-react';
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
// 2. Component LoginForm พร้อมระบบ 1-Click Role Fill และ Show/Hide Password
// =========================================================================
export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  loading,
  onSubmit,
}) => {
  // เก็บข้อความ Error ของแต่ละช่อง
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  // สถานะเปิด/ปิดตาดูรหัสผ่าน
  const [showPassword, setShowPassword] = useState(false);

  // ฟังก์ชันเลือกบัญชี Demo แบบคลิกเดียว (1-Click Fill)
  const handleSelectDemo = (demoUser: string) => {
    setUsername(demoUser);
    setPassword('MangoVPN2026!');
    setErrors({});
  };

  // ฟังก์ชันดักจับตอนกดปุ่ม Submit เพื่อตรวจฟอร์มด้วย Zod ก่อนส่งต่อ
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. ใช้ Zod ตรวจสอบข้อมูลในฟอร์ม (ตัดช่องว่างหน้าหลังออกด้วย trim())
    const trimmedUsername = username.trim();
    const validationResult = loginSchema.safeParse({ username: trimmedUsername, password });

    // 2. ถ้าไม่ผ่านเกณฑ์
    if (!validationResult.success) {
      const fieldErrors: { username?: string; password?: string } = {};

      validationResult.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as 'username' | 'password';
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      });

      setErrors(fieldErrors);
      return;
    }

    // 3. ถ้าผ่านเกณฑ์ฉลุย
    setErrors({});
    onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* หัวข้อฟอร์ม */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Sign in to MANGO VPN</h2>
        <p className="text-xs text-slate-400 mt-1">
          Zero-Trust Remote Access Control Gateway
        </p>
      </div>

      {/* ปุ่ม 1-Click เลือกบทบาททดสอบ (Quick Select Role) */}
      <div className="pt-1">
        <label className="block text-[11px] font-medium text-slate-400 mb-1.5">
          Quick Demo Accounts (1-Click Fill):
        </label>
        <div className="grid grid-cols-3 gap-2">
          {/* ปุ่ม Admin */}
          <button
            type="button"
            onClick={() => handleSelectDemo('admin_user')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition cursor-pointer ${
              username === 'admin_user'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin</span>
          </button>

          {/* ปุ่ม Staff */}
          <button
            type="button"
            onClick={() => handleSelectDemo('staff_user')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition cursor-pointer ${
              username === 'staff_user'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span>Staff</span>
          </button>

          {/* ปุ่ม Client */}
          <button
            type="button"
            onClick={() => handleSelectDemo('client_user')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition cursor-pointer ${
              username === 'client_user'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Client</span>
          </button>
        </div>
      </div>

      {/* ช่องกรอกข้อมูล (Inputs) */}
      <div className="space-y-3 pt-1">
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
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              placeholder="e.g. staff_user"
              className={`w-full pl-9 pr-3 py-2 bg-slate-950 border rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition ${
                errors.username
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-800 focus:border-amber-500'
              }`}
            />
          </div>
          {errors.username && (
            <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.username}</span>
            </p>
          )}
        </div>

        {/* ช่องที่ 2: Password พร้อมปุ่ม Show/Hide Password */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="••••••••••••"
              className={`w-full pl-9 pr-10 py-2 bg-slate-950 border rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none transition font-mono ${
                errors.password
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-800 focus:border-amber-500'
              }`}
            />
            {/* ปุ่มคลิกเปิด/ปิดตาดูรหัสผ่าน */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition cursor-pointer p-0.5 rounded"
              title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-amber-400" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1">
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

      {/* ข้อมูลแนะนำรหัสผ่าน */}
      <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
        <div className="font-semibold text-slate-300">💡 Default Password:</div>
        <div className="font-mono text-amber-400 font-bold">MangoVPN2026!</div>
        <div className="text-[10px] text-slate-500">
          คลิกที่ปุ่มลัดด้านบน (Admin / Staff / Client) เพื่อสลับบทบาทในการทดสอบได้ทันที
        </div>
      </div>
    </form>
  );
};
