import React, { useState, useEffect } from 'react';
import {
  Monitor,
  Building2,
  Lock,
  Copy,
  Check,
  RefreshCw,
  Moon,
  Cloud,
  FlaskConical,
  Globe,
  Layers,
} from 'lucide-react';
import { RoleName } from '@mango/shared';
import { useI18n } from '../i18n/I18nContext';
import { formatMessage } from '../i18n/translations';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ADMIN_GATEWAYS, GatewayTarget } from '../types/gateway';

// =========================================================================
// 1. Props Interface
// =========================================================================
interface VpnDashboardProps {
  user: {
    username: string;
    role: RoleName;
    phoneNumber?: string;
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
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// =========================================================================
// 2. Component VpnDashboard (ออกแบบตามภาพดีไซน์ Enterprise Modern UI)
// =========================================================================
export const VpnDashboard: React.FC<VpnDashboardProps> = ({
  user,
  assignedIp,
  connectionState,
  bytesRx,
  bytesTx,
  agentInstalled,
  loading,
  onConnect,
  onDisconnect,
  onNotify,
}) => {
  const { t } = useI18n();

  // สลับไอคอนติ๊กถูกเมื่อกดคัดลอก IP
  const [copiedIp, setCopiedIp] = useState(false);

  // สภาพแวดล้อมเกตเวย์เป้าหมายสำหรับ Admin (ค่าเริ่มต้น: Global Internet Egress)
  const [selectedGatewayId, setSelectedGatewayId] = useState<string>('gw-egress');
  const selectedGateway: GatewayTarget =
    ADMIN_GATEWAYS.find((g) => g.id === selectedGatewayId) || ADMIN_GATEWAYS[3];

  const renderGatewayIcon = (icon: 'building' | 'cloud' | 'flask' | 'globe', className: string) => {
    switch (icon) {
      case 'cloud':
        return <Cloud className={className} />;
      case 'flask':
        return <FlaskConical className={className} />;
      case 'globe':
        return <Globe className={className} />;
      case 'building':
      default:
        return <Building2 className={className} />;
    }
  };

  // ตัวนับเวลาการเชื่อมต่อ (Connected Duration Timer: HH:MM:SS)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (connectionState === 'connected') {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [connectionState]);

  // ฟังก์ชันแปลงวินาทีเป็นรูปแบบ 00:12:41
  const formatDuration = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0'),
    ].join(':');
  };

  // คัดลอก IP ลงคลิปบอร์ด
  const handleCopyIp = async () => {
    if (!assignedIp) return;
    try {
      await navigator.clipboard.writeText(assignedIp);
      setCopiedIp(true);
      onNotify?.(formatMessage(t.toasts.ipCopied, { ip: assignedIp }), 'success');
      setTimeout(() => setCopiedIp(false), 2000);
    } catch {
      onNotify?.(t.toasts.ipCopyError, 'error');
    }
  };

  const isConnected = connectionState === 'connected';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. แถบหัวด้านบน: Breadcrumb & ไฟสถานะเชื่อมต่อ */}
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-emerald-400 tracking-wider">
          {'// CONNECT'}
        </div>

        <div className="flex items-center space-x-2">
          {/* ป้ายสถานะเชื่อมต่อ */}
          <div
            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1.5 border transition ${
              isConnected
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-400'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
              }`}
            />
            <span>{isConnected ? t.dashboard.connected : t.dashboard.disconnected}</span>
          </div>

          {/* ป้ายโหมดมืด */}
          <div className="px-3 py-1 rounded-full text-xs text-slate-400 bg-slate-900/80 border border-slate-800 flex items-center space-x-1.5">
            <Moon className="w-3.5 h-3.5" />
            <span>{t.dashboard.darkMode}</span>
          </div>

          {/* ปุ่มสลับภาษา TH / EN (Top-Right Utility ตามหลัก HCI) */}
          <LanguageSwitcher compact />
        </div>
      </div>

      {/* 2. ข้อความต้อนรับผู้ใช้ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {formatMessage(t.dashboard.greeting, { username: user.username })}
        </h1>
        <span
          className={`text-xs font-mono font-semibold px-3 py-1 rounded-full border ${
            user.role === 'ADMIN'
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
              : user.role === 'STAFF'
              ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          }`}
        >
          {user.role === 'ADMIN'
            ? t.dashboard.roleAdminLabel
            : user.role === 'STAFF'
            ? t.dashboard.roleStaffLabel
            : t.dashboard.roleClientLabel}
        </span>
      </div>

      {/* 2.1 แผงเลือกสภาพแวดล้อมเกตเวย์ (Multi-Gateway Environment Selector สำหรับ ADMIN) */}
      {user.role === 'ADMIN' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-mono tracking-wider text-emerald-400 font-semibold uppercase flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>{t.dashboard.targetEnvironment}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              {isConnected
                ? `${t.dashboard.currentConnectedTo} ${t.dashboard.gateways[selectedGateway.nameKey]}`
                : t.dashboard.selectGateway}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {ADMIN_GATEWAYS.map((gw) => {
              const isSelected = selectedGatewayId === gw.id;
              return (
                <button
                  key={gw.id}
                  type="button"
                  onClick={() => !loading && setSelectedGatewayId(gw.id)}
                  disabled={loading}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'bg-[#080d0a] border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/40 text-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                      {renderGatewayIcon(gw.icon, `w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`)}
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                          : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                    >
                      {gw.subnet}
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {t.dashboard.gateways[gw.nameKey]}
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                      {t.dashboard.gateways[gw.descKey]}
                    </p>
                  </div>

                  {isSelected && (
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. การ์ดแผนภาพอุโมงค์ VPN (Secure Tunnel Diagram Card) */}
      <div className="bg-[#0b100d] border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono tracking-widest text-emerald-400 font-semibold uppercase">
            SECURE TUNNEL · ENCRYPTED
          </div>
          {user.role === 'ADMIN' && (
            <div className="text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{t.dashboard.gateways[selectedGateway.nameKey]}</span>
            </div>
          )}
        </div>

        {/* แผนภาพเชื่อมต่อระหว่างเครื่องและเน็ตเวิร์ก */}
        <div className="relative flex items-center justify-between px-8 py-3">
          {/* ฝั่งซ้าย: เครื่องของคุณ */}
          <div className="flex flex-col items-center space-y-2 z-10">
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200">
              <Monitor className="w-6 h-6" />
            </div>
            <span className="text-xs text-slate-400 font-medium">{t.dashboard.yourDevice}</span>
          </div>

          {/* เส้นทางการเชื่อมต่อตรงกลาง พร้อมไอคอนกุญแจล็อค */}
          <div className="relative flex-1 flex items-center justify-center mx-6">
            {/* เส้นเชื่อมต่อ */}
            <div
              className={`w-full h-0.5 transition-colors duration-500 ${
                isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-800'
              }`}
            />
            {/* ไอคอนกุญแจล็อคตรงกลาง */}
            <div
              className={`absolute w-8 h-8 rounded-full border flex items-center justify-center transition ${
                isConnected
                  ? 'bg-[#0b100d] border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/30'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}
            >
              <Lock className="w-4 h-4" />
            </div>
          </div>

          {/* ฝั่งขวา: Private Network หรือ Gateway ที่เลือก */}
          <div className="flex flex-col items-center space-y-2 z-10 max-w-[170px] text-center">
            <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200">
              {user.role === 'ADMIN' ? (
                renderGatewayIcon(selectedGateway.icon, `w-6 h-6 ${isConnected ? 'text-emerald-400' : 'text-slate-300'}`)
              ) : (
                <Building2 className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-slate-300 font-medium leading-tight">
                {user.role === 'CLIENT'
                  ? 'Web Portal'
                  : user.role === 'STAFF'
                  ? 'Office Subnets'
                  : t.dashboard.gateways[selectedGateway.nameKey]}
              </div>
              <div className="text-[10px] font-mono text-emerald-400/80">
                {user.role === 'CLIENT'
                  ? '10.13.13.100'
                  : user.role === 'STAFF'
                  ? '10.0.0.0/8'
                  : selectedGateway.subnet}
              </div>
            </div>
          </div>
        </div>

        {/* ปุ่มควบคุมการเชื่อมต่อ และ Endpoint */}
        <div className="pt-2 flex flex-wrap items-center space-x-4">
          {isConnected ? (
            <button
              onClick={onDisconnect}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium text-xs transition cursor-pointer disabled:opacity-50"
            >
              {t.dashboard.disconnect}
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={loading || !agentInstalled}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
            >
              {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? t.dashboard.connecting : t.dashboard.connectVpn}</span>
            </button>
          )}

          <div className="text-xs text-slate-400 font-mono">
            WireGuard · endpoint{' '}
            <span className="text-slate-300 font-semibold">
              {user.role === 'ADMIN' ? selectedGateway.endpoint : 'vpn.mangovpn.internal:51820'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. การ์ดสถิติ 4 ช่อง (4 Metrics Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* กล่อง 1: VPN IP */}
        <div className="bg-[#0b100d] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">VPN IP</div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm md:text-base font-bold text-white">
              {assignedIp
                ? `${assignedIp}/32`
                : isConnected
                ? user.role === 'ADMIN'
                  ? selectedGateway.defaultIp
                  : '10.13.13.45/32'
                : t.dashboard.notAssigned}
            </span>
            {(assignedIp || isConnected) && (
              <button
                onClick={handleCopyIp}
                className="p-1 text-slate-400 hover:text-emerald-400 rounded transition cursor-pointer"
                title={t.dashboard.copyIpTitle}
              >
                {copiedIp ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* กล่อง 2: RX (ดาวน์โหลด) */}
        <div className="bg-[#0b100d] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">RX</div>
          <div className="font-mono text-sm md:text-base font-bold text-white">
            {isConnected ? `${(bytesRx / 1024).toFixed(1)} KB` : '0.0 KB'}
          </div>
        </div>

        {/* กล่อง 3: TX (อัปโหลด) */}
        <div className="bg-[#0b100d] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">TX</div>
          <div className="font-mono text-sm md:text-base font-bold text-white">
            {isConnected ? `${(bytesTx / 1024).toFixed(1)} KB` : '0.0 KB'}
          </div>
        </div>

        {/* กล่อง 4: เวลาเชื่อมต่อ */}
        <div className="bg-[#0b100d] border border-slate-800/80 rounded-xl p-4 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">{t.dashboard.duration}</div>
          <div className="font-mono text-sm md:text-base font-bold text-white">
            {isConnected ? formatDuration(elapsedSeconds) : '00:00:00'}
          </div>
        </div>
      </div>

      {/* 5. แผงข้อมูลด้านล่าง 2 คอลัมน์ (Connection Log & Allowed Networks) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* คอลัมน์ซ้าย: CONNECTION LOG สไตล์ Terminal */}
        <div className="bg-[#080d0a] border border-slate-800/80 rounded-xl p-4 space-y-3 font-mono text-xs">
          <div className="text-[11px] font-mono text-emerald-400 font-semibold tracking-wider">
            CONNECTION LOG
          </div>
          <div className="space-y-1.5 text-slate-300 text-[11px]">
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-bold">[ OK ]</span>
              <span>auth/verify-otp</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-emerald-400 font-bold">[ OK ]</span>
              <span>agent /health · v1.0.0</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isConnected ? '[ OK ]' : '[ .. ]'}
              </span>
              <span>agent /connect</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {isConnected ? '[ OK ]' : '[ .. ]'}
              </span>
              <span>
                {isConnected
                  ? `tunnel up · ${assignedIp ? `${assignedIp}/32` : '10.13.13.45/32'}`
                  : 'waiting for tunnel...'}
              </span>
            </div>
          </div>
        </div>

        {/* คอลัมน์ขวา: เครือข่ายที่เข้าถึงได้, บริการภายใน & Public Key */}
        <div className="bg-[#080d0a] border border-slate-800/80 rounded-xl p-4 space-y-4 text-xs">
          <div>
            <div className="text-emerald-400 font-semibold text-xs mb-1.5 flex items-center justify-between">
              <span>{t.dashboard.allowedNetworks}</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal">
                {user.role === 'CLIENT'
                  ? t.dashboard.accessRestricted
                  : user.role === 'STAFF'
                  ? t.dashboard.accessCorporate
                  : `${t.dashboard.accessFull} · ${t.dashboard.gateways[selectedGateway.nameKey]}`}
              </span>
            </div>
            <div className="font-mono text-slate-300 text-xs tracking-wide bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
              {user.role === 'CLIENT'
                ? '10.13.13.100/32 : 80, 443'
                : user.role === 'STAFF'
                ? '10.0.0.0/8, 172.16.0.0/12'
                : `${selectedGateway.subnet} (${t.dashboard.gateways[selectedGateway.nameKey]})`}
            </div>
          </div>

          {/* รายการบริการภายใน (Internal Services) สำหรับ Admin */}
          {user.role === 'ADMIN' && (
            <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
              <div className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold">
                INTERNAL SERVICES ({selectedGateway.internalServices.length})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {selectedGateway.internalServices.map((srv, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded bg-slate-900/60 border border-slate-800/60 text-[10px] flex items-center justify-between"
                  >
                    <span className="text-slate-300 font-medium truncate">{srv.name}</span>
                    <span className="text-emerald-400 font-mono text-[9px] shrink-0 ml-1">
                      :{srv.port}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800/60">
            <div className="text-[10px] font-mono tracking-wider text-emerald-400 uppercase font-semibold mb-1">
              PUBLIC KEY
            </div>
            <div className="font-mono text-slate-300 text-xs">
              k7Qp..aX9=
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
