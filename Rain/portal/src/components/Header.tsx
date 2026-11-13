import React from 'react';
import { Activity, LogOut } from 'lucide-react';

// =========================================================================
// 1. กำหนด Type ของ Props (เปรียบเหมือนการกำหนด Parameter ในฟังก์ชัน PHP)
// =========================================================================
interface HeaderProps {
  portalOnline: boolean;        // สถานะ API Backend (true = เขียว, false = แดง)
  agentInstalled: boolean;      // ตัวแทน Agent ในเครื่อง (true/false)
  agentVersion: string;         // เวอร์ชันของ Agent เช่น "1.0.0-mock"
  connectionState: 'disconnected' | 'connecting' | 'connected'; // สถานะ VPN
  isLoggedIn: boolean;          // ล็อกอินอยู่หรือไม่
  onSignOut: () => void;        // ฟังก์ชันสั่ง Logout เมื่อกดปุ่ม
}

// =========================================================================
// 2. Component Header (เปรียบเหมือนฟังก์ชัน Render หน้า Header)
// =========================================================================
export const Header: React.FC<HeaderProps> = ({
  portalOnline,
  agentInstalled,
  agentVersion,
  connectionState,
  isLoggedIn,
  onSignOut,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      {/* ฝั่งซ้าย: โลโก้และชื่อระบบ */}
      <div className="flex items-center space-x-3">
        {/* กล่องไอคอนมะม่วงพร้อมเอฟเฟกต์สีส้ม-ทอง */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-xl shadow-lg shadow-amber-500/20">
          🥭
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-lg tracking-wide text-white">MANGO VPN</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
              Zero-Trust v0.1
            </span>
          </div>
          <p className="text-xs text-slate-400">Enterprise WireGuard Remote Access</p>
        </div>
      </div>

      {/* ฝั่งขวา: ไฟสถานะ 3 ดวง (Status Indicator Pills) และปุ่ม Logout */}
      <div className="flex items-center space-x-3 text-xs font-medium">
        
        {/* ไฟดวงที่ 1: สถานะ Portal Backend API */}
        <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              portalOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300">
            {portalOnline ? 'Portal Online' : 'API Offline'}
          </span>
        </div>

        {/* ไฟดวงที่ 2: สถานะ Windows Agent ในเครื่อง (127.0.0.1:47821) */}
        <div
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${
            agentInstalled
              ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              agentInstalled ? 'bg-emerald-400' : 'bg-rose-500'
            }`}
          />
          <span>
            Agent: {agentInstalled ? `Installed (${agentVersion})` : 'Missing (127.0.0.1:47821)'}
          </span>
        </div>

        {/* ไฟดวงที่ 3: สถานะการเชื่อมต่อ VPN Tunnel */}
        <div
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full border ${
            connectionState === 'connected'
              ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200'
              : connectionState === 'connecting'
              ? 'bg-amber-900/40 border-amber-500 text-amber-200 animate-pulse'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="capitalize">{connectionState}</span>
        </div>

        {/* ปุ่ม Logout (แสดงเฉพาะเมื่อล็อกอินแล้ว) */}
        {isLoggedIn && (
          <button
            onClick={onSignOut}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};
