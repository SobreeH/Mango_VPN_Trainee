import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Copy,
  Check,
  ArrowDownCircle,
  ArrowUpCircle,
} from 'lucide-react';
import { RoleName } from '@mango/shared';

// =========================================================================
// 1. Props Interface
// =========================================================================
interface VpnDashboardProps {
  user: {
    username: string;
    role: RoleName;
    phoneNumber: string;
  };
  assignedIp: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected';
  bytesRx: number;
  bytesTx: number;
  agentInstalled: boolean;
  agentVersion: string;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void; // ฟังก์ชันยิง Toast
}

// =========================================================================
// 2. Component VpnDashboard พร้อมปุ่ม Quick Copy และไอคอน Telemetry
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
  onNotify,
}) => {
  // จำว่ากำลังกดคัดลอกช่องไหนอยู่ ('ip' | 'endpoint' | null) เพื่อสลับเป็นไอคอนติ๊กถูก
  const [copiedField, setCopiedField] = useState<'ip' | 'endpoint' | null>(null);

  // ฟังก์ชันก๊อปปี้ข้อความลงคลิปบอร์ด
  const handleCopy = async (text: string, field: 'ip' | 'endpoint', label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      onNotify?.(`คัดลอก ${label} (${text}) เรียบร้อยแล้ว`, 'success');

      // สลับกลับเป็นไอคอนเดิมหลังผ่านไป 2 วินาที
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch {
      onNotify?.('ไม่สามารถคัดลอกข้อความได้', 'error');
    }
  };

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
        
        {/* แถวที่ 1: Assigned VPN IP พร้อมปุ่ม Copy */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Assigned VPN IP</span>
          <div className="flex items-center space-x-1.5">
            <span className="font-mono text-emerald-400 font-bold">
              {assignedIp || 'Not Assigned'}
            </span>
            {assignedIp && (
              <button
                onClick={() => handleCopy(assignedIp, 'ip', 'VPN IP')}
                className="p-1 text-slate-500 hover:text-emerald-400 rounded hover:bg-slate-900 transition cursor-pointer"
                title="คัดลอก IP"
              >
                {copiedField === 'ip' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* แถวที่ 2: Endpoint พร้อมปุ่ม Copy */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Endpoint</span>
          <div className="flex items-center space-x-1.5">
            <span className="font-mono text-slate-300">127.0.0.1:51820</span>
            <button
              onClick={() => handleCopy('127.0.0.1:51820', 'endpoint', 'Endpoint')}
              className="p-1 text-slate-500 hover:text-amber-400 rounded hover:bg-slate-900 transition cursor-pointer"
              title="คัดลอก Endpoint"
            >
              {copiedField === 'endpoint' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* แถวที่ 3: สถิติปริมาณเน็ต RX/TX พร้อมไอคอนลูกศรทิศทาง */}
        {connectionState === 'connected' && (
          <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px] font-mono">
            {/* ดาวน์โหลด (RX) */}
            <div className="flex items-center space-x-1.5 text-emerald-400">
              <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>RX: {(bytesRx / 1024).toFixed(1)} KB</span>
            </div>

            {/* อัปโหลด (TX) */}
            <div className="flex items-center justify-end space-x-1.5 text-sky-400">
              <ArrowUpCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>TX: {(bytesTx / 1024).toFixed(1)} KB</span>
            </div>
          </div>
        )}
      </div>

      {/* ปุ่มสั่งงานหลัก: สลับระหว่าง VPN CONNECT (เขียว) และ DISCONNECT (แดง) */}
      {connectionState !== 'connected' ? (
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
        <button
          onClick={onDisconnect}
          disabled={loading}
          className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wide uppercase rounded-xl transition shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 text-sm cursor-pointer disabled:opacity-50"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>DISCONNECT VPN</span>
        </button>
      )}

      {/* คำเตือนเมื่อยังไม่ได้รัน mock-agent.js */}
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
