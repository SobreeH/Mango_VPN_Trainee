import React from 'react';
import { User as UserIcon, Lock, ArrowRight, RefreshCw } from 'lucide-react';

// =========================================================================
// 1. Props Interface: กำหนดค่าที่ LoginForm ต้องการรับจากตัวแม่ (App.tsx)
// =========================================================================
interface LoginFormProps {
  username: string;                              // ค่า Username ปัจจุบัน
  setUsername: (value: string) => void;          // ฟังก์ชันอัปเดต Username เมื่อผู้ใช้พิมพ์
  password: string;                              // ค่า Password ปัจจุบัน
  setPassword: (value: string) => void;          // ฟังก์ชันอัปเดต Password เมื่อผู้ใช้พิมพ์
  loading: boolean;                              // กำลังโหลดอยู่หรือไม่ (กดส่งแล้วรอ API)
  onSubmit: (e: React.FormEvent) => void;        // ฟังก์ชันเมื่อผู้ใช้กดปุ่ม Submit
}

// =========================================================================
// 2. Component LoginForm: แสดงฟอร์มเข้าสู่ระบบ
// =========================================================================
export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  loading,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
            {/* ไอคอนรูปคน วางซ้อนด้านซ้ายของช่องกรอก */}
            <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your.username"
              required
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* ช่องที่ 2: Password */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Password
          </label>
          <div className="relative">
            {/* ไอคอนแม่กุญแจ */}
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
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
            /* ถ้าอยู่ในสถานะ Loading ให้หมุนไอคอน Spinner */
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            /* สถานะปกติ แสดงข้อความและลูกศร */
            <>
              <span>Continue to MFA</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* กล่องแสดงบัญชีสำหรับทดสอบ (Demo Credentials Box) */}
      <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
        <span className="font-semibold text-slate-300 block">Default Demo Credentials:</span>
        <div>• Admin: <code className="text-amber-400">admin_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
        <div>• Staff: <code className="text-amber-400">staff_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
        <div>• Client: <code className="text-amber-400">client_user</code> / <code className="text-amber-400">MangoVPN2026!</code></div>
      </div>
    </form>
  );
};
