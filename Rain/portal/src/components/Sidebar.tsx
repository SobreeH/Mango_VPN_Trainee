import React from 'react';
import {
  ShieldCheck,
  Clock,
  Monitor,
  Download,
  LogOut,
  Shield,
  User,
  AlignLeft,
  Package,
} from 'lucide-react';
import { RoleName } from '@mango/shared';
import { useI18n } from '../i18n/I18nContext';

export type NavTab =
  | 'connect'
  | 'history'
  | 'devices'
  | 'users'
  | 'policies'
  | 'audit_logs'
  | 'agent';

interface SidebarProps {
  user: {
    username: string;
    role: RoleName;
    phoneNumber?: string;
  };
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onSignOut,
}) => {
  const { t } = useI18n();

  // กำหนดรายการเมนูตามบทบาท (Role-Based Sidebar Navigation) ตรงตามดีไซน์
  let navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [];

  if (user.role === 'ADMIN') {
    // ฝั่ง ADMIN: มีครบทั้ง 7 เมนู (Agent แสดงเป็น Package Registry)
    navItems = [
      { id: 'connect', label: t.sidebar.nav.connect, icon: ShieldCheck },
      { id: 'history', label: t.sidebar.nav.history, icon: Clock },
      { id: 'devices', label: t.sidebar.nav.devices, icon: Monitor },
      { id: 'users', label: t.sidebar.nav.users, icon: User },
      { id: 'policies', label: t.sidebar.nav.policies, icon: Shield },
      { id: 'audit_logs', label: t.sidebar.nav.audit_logs, icon: AlignLeft },
      { id: 'agent', label: t.sidebar.nav.agentReleases, icon: Package },
    ];
  } else if (user.role === 'STAFF') {
    // ฝั่ง STAFF: 4 เมนู
    navItems = [
      { id: 'connect', label: t.sidebar.nav.connect, icon: ShieldCheck },
      { id: 'history', label: t.sidebar.nav.history, icon: Clock },
      { id: 'devices', label: t.sidebar.nav.devices, icon: Monitor },
      { id: 'agent', label: t.sidebar.nav.agent, icon: Download },
    ];
  } else {
    // ฝั่ง CLIENT: 3 เมนู (ซ่อนอุปกรณ์, ผู้ใช้, นโยบาย, และ Audit Logs)
    navItems = [
      { id: 'connect', label: t.sidebar.nav.connect, icon: ShieldCheck },
      { id: 'history', label: t.sidebar.nav.history, icon: Clock },
      { id: 'agent', label: t.sidebar.nav.agent, icon: Download },
    ];
  }

  return (
    <aside className="w-56 bg-[#080d0a] border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0 select-none">
      {/* 1. ส่วนหัว: แบรนด์ MANGO VPN */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 px-2 pt-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-white tracking-wider text-base">
            MANGO VPN
          </span>
        </div>

        {/* 2. รายการเมนูนำทาง (Navigation Items) */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. ส่วนล่าง: โปรไฟล์ผู้ใช้ ตัวเลือกภาษา และปุ่ม Logout */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3">
        {/* ข้อมูลผู้ใช้และ Role */}
        <div className="px-2">
          <div className="font-semibold text-white text-sm tracking-wide truncate">
            {user.username}
          </div>
          <div className="mt-1 flex items-center space-x-1.5">
            <span
              className={`inline-block text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border uppercase ${
                user.role === 'ADMIN'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : user.role === 'STAFF'
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              }`}
            >
              {user.role}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 font-mono">
            {user.role === 'CLIENT'
              ? t.dashboard.accessRestricted
              : user.role === 'STAFF'
              ? t.dashboard.accessCorporate
              : t.dashboard.accessFull}
          </div>
        </div>

        {/* ปุ่มออกจากระบบ */}
        <button
          onClick={onSignOut}
          className="w-full flex items-center space-x-2 px-2 py-2 text-rose-400/90 hover:text-rose-300 text-xs font-medium transition rounded-lg hover:bg-rose-950/20 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.sidebar.signOut}</span>
        </button>
      </div>
    </aside>
  );
};
