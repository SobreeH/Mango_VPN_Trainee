import React from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { RoleName } from '@mango/shared';

// =========================================================================
// 1. Props Interface: ข้อมูลและฟังก์ชันที่ VpnDashboard ต้องการ
// =========================================================================
interface VpnDashboardProps {
  user: {
    username: string;
    role: RoleName;
    phoneNumber: string;
  };
  assignedIp: string | null;                                    // IP ที่ได้รับ เช่น "10.13.13.45/32"
  connectionState: 'disconnected' | 'connecting' | 'connected'; // สถานะเชื่อมต่อ
  bytesRx: number;                                             // ปริมาณดาวน์โหลด (Bytes Received)
  bytesTx: number;                                             // ปริมาณอัปโหลด (Bytes Transmitted)
  agentInstalled: boolean;                                     // เปิด mock-agent.js อยู่หรือไม่
  agentVersion: string;                                        // เช่น "1.0.0-mock"
  loading: boolean;                                            // กำลังรันคำสั่งอยู่หรือไม่
  onConnect: () => void;                                       // ฟังก์ชันสั่งเชื่อมต่อ VPN
  onDisconnect: () => void;                                    // ฟังก์ชันสั่งตัดการเชื่อมต่อ VPN
}

// =========================================================================
// 2. Component VpnDashboard: หน้าจอควบคุม VPN
// =========================================================================
export const VpnDashboard: React.FC<VpnDashboardProps> = ({
  user,
  assignedIp,
  connectionState,
  bytesRx,
  bytesTx,
  agentInstalled,
  agentVersion,
  loading,
  onConnect,
  onDisconnect,
}) => {
  return (
    <div className="space-y-5">
      {/* ส่วนบน: ข้อมูลผู้ใช้และ Role */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="font-semibold text-white tracking-wide">{user.username}</h3>
          <span className="text-xs text-slate-400">
            Role: <span className="text-amber-400 font-mono font-medium">{user.role}</span>
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">
            {user.phoneNumber}
          </span>
        </div>
      </div>

      {/* การ์ดแสดงสถานะเครือข่าย (Network Status Card) */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        {/* แถวที่ 1: VPN IP */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Assigned VPN IP</span>
          <span className="font-mono text-emerald-400 font-bold">
            {assignedIp || 'Not Assigned'}
          </span>
        </div>

        {/* แถวที่ 2: Endpoint */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Endpoint</span>
          <span className="font-mono text-slate-300">127.0.0.1:51820 (WireGuard)</span>
        </div>

        {/* แถวที่ 3: สถิติปริมาณเน็ต RX/TX (แสดงเฉพาะเมื่อเชื่อมต่อสำเร็จแล้ว) */}
        {connectionState === 'connected' && (
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] text-slate-400 font-mono">
            <div>RX: {(bytesRx / 1024).toFixed(1)} KB</div>
            <div className="text-right">TX: {(bytesTx / 1024).toFixed(1)} KB</div>
          </div>
        )}
      </div>

      {/* ปุ่มสั่งงานหลัก: สลับระหว่าง VPN CONNECT (เขียว) และ DISCONNECT (แดง) */}
      {connectionState !== 'connected' ? (
        /* ปุ่มสีเขียว: สั่งเชื่อมต่อ VPN */
        <button
          onClick={onConnect}
          disabled={loading || !agentInstalled}
          className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black tracking-wider uppercase rounded-xl transition shadow-xl shadow-emerald-500/20 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-base cursor-pointer"
        >
          {loading ? (
            <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>VPN CONNECT</span>
            </>
          )}
        </button>
      ) : (
        /* ปุ่มสีแดง: สั่งตัดการเชื่อมต่อ */
        <button
          onClick={onDisconnect}
          disabled={loading}
          className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wide uppercase rounded-xl transition shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-50"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>DISCONNECT VPN</span>
        </button>
      )}

      {/* คำเตือนสีส้ม: แสดงเมื่อยังไม่ได้เปิด mock-agent.js */}
      {!agentInstalled && (
        <div className="p-3 bg-amber-950/30 border border-amber-800/60 rounded-lg text-xs text-amber-300 space-y-1">
          <div className="font-semibold flex items-center space-x-1">
            <span>⚠️ Client Agent Not Running</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Run the mock agent simulator in your terminal:
          </p>
          <code className="block bg-slate-950 p-1.5 rounded text-amber-400 font-mono text-[11px] border border-slate-800">
            npm run mock:agent
          </code>
        </div>
      )}

      {/* สรุปสถานะย่อยด้านล่างสุด */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
        <div className="flex justify-between items-center">
          <span>Agent Status:</span>
          <span className={`font-mono ${agentInstalled ? 'text-emerald-400' : 'text-rose-400'}`}>
            {agentInstalled ? `Installed [${agentVersion}]` : 'Not Detected'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span>Connection:</span>
          <span
            className={`font-mono capitalize ${
              connectionState === 'connected' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
            }`}
          >
            [{connectionState}]
          </span>
        </div>
      </div>
    </div>
  );
};
