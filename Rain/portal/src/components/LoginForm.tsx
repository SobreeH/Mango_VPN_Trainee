import React, { useState } from 'react';
import {
  Shield,
  RefreshCw,
  AlertCircle,
  Crown,
  UserCheck,
} from 'lucide-react';
import { createLoginSchema } from '../schemas/auth.schema';
import { useI18n } from '../i18n/I18nContext';

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
// 2. Component LoginForm (ออกแบบถอดแบบเป๊ะๆ ตาม Mobile App UI)
// =========================================================================
export const LoginForm: React.FC<LoginFormProps> = ({
  username,
  setUsername,
  password,
  setPassword,
  loading,
  onSubmit,
}) => {
  const { t } = useI18n();
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  // ฟังก์ชันเลือกบัญชี Demo 1-Click
  const handleSelectDemo = (demoUser: string) => {
    setUsername(demoUser);
    setPassword('MangoVPN2026!');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUsername = username.trim();
    const validationResult = createLoginSchema(t.validation).safeParse({ username: trimmedUsername, password });

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

    setErrors({});
    onSubmit(e);
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

        {/* 2. หัวข้อฟอร์ม และ Step Progress Bar (ขั้นตอนที่ 1 จาก 3) */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono tracking-widest text-emerald-400 font-semibold uppercase">
            SECURE CHANNEL · TLS 1.3
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t.login.title}
          </h1>
          <p className="text-xs text-slate-400">
            {t.login.stepSubtitle}
          </p>

          {/* แถบความคืบหน้า 3 ท่อน (Step Indicator) */}
          <div className="flex space-x-2 pt-2">
            <div className="h-1 bg-emerald-500 rounded-full flex-1" />
            <div className="h-1 bg-slate-800/80 rounded-full flex-1" />
            <div className="h-1 bg-slate-800/80 rounded-full flex-1" />
          </div>
        </div>

        {/* 3. ปุ่มลัดทดสอบ Demo Accounts (1-Click Fill) */}
        <div className="pt-1">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => handleSelectDemo('admin_user')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition cursor-pointer ${
                username === 'admin_user'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Admin</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectDemo('staff_user')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition cursor-pointer ${
                username === 'staff_user'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3 text-sky-400" />
              <span>Staff</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectDemo('client_user')}
              className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 border transition cursor-pointer ${
                username === 'client_user'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3 h-3 text-emerald-400" />
              <span>Client</span>
            </button>
          </div>
        </div>

        {/* 4. ช่องกรอกข้อมูล (Inputs) */}
        <div className="space-y-4 pt-1">
          {/* ช่องที่ 1: ชื่อผู้ใช้ */}
          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1.5">
              {t.login.usernameLabel}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              placeholder={t.login.usernamePlaceholder}
              className={`w-full px-3.5 py-3 bg-[#070e0a] border rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition ${
                errors.username
                  ? 'border-rose-500 focus:border-rose-500'
                  : 'border-slate-800 focus:border-emerald-500'
              }`}
            />
            {errors.username && (
              <p className="text-xs text-rose-400 mt-1 flex items-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.username}</span>
              </p>
            )}
          </div>

          {/* ช่องที่ 2: รหัสผ่าน */}
          <div>
            <label className="block text-xs font-medium text-slate-200 mb-1.5">
              {t.login.passwordLabel}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                placeholder="••••••••••"
                className={`w-full pl-3.5 pr-14 py-3 bg-[#070e0a] border rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none transition font-mono ${
                  errors.password
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-800 focus:border-emerald-500'
                }`}
              />
              {/* ปุ่มคลิก แสดง / ซ่อน ตัวหนังสือสีเขียว */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition cursor-pointer select-none"
              >
                {showPassword ? t.login.hidePassword : t.login.showPassword}
              </button>
            </div>

            {/* ข้อความกำกับใต้ช่องรหัสผ่าน */}
            <div className="flex justify-between items-center mt-1">
              {errors.password ? (
                <p className="text-xs text-rose-400 flex items-center space-x-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.password}</span>
                </p>
              ) : (
                <span className="text-[11px] text-slate-400">{t.login.passwordHint}</span>
              )}
            </div>
          </div>
        </div>

        {/* 5. ปุ่มใหญ่: เข้าสู่ระบบ */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-900/30 flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <span>{t.login.submit}</span>
            )}
          </button>
        </div>
      </form>

      {/* 6. ส่วนล่างสุด: ลิงก์ดาวน์โหลด Agent และติดต่อ Admin */}
      <div className="text-center text-xs text-slate-400 pt-8 pb-2">
        <span>{t.login.agentNotInstalled}</span>
        <button
          type="button"
          onClick={() => alert(t.login.downloadAgentAlert)}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition cursor-pointer"
        >
          {t.login.downloadAgent}
        </button>
        <span className="text-slate-500 mx-1">·</span>
        <button
          type="button"
          onClick={() => alert(t.login.contactAdminAlert)}
          className="text-emerald-400 hover:text-emerald-300 font-medium transition cursor-pointer"
        >
          {t.login.contactAdmin}
        </button>
      </div>
    </div>
  );
};
