import { useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Globe,
  Laptop,
  Lock,
  Shield,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { RoleName } from '@mango/shared';
import { getThemeClasses, type UiLang } from '../lib/theme';

type TopologyNodeId = 'client' | 'gateway' | 'network';

export interface NetworkTopologyProps {
  isConnected: boolean;
  assignedIp?: string | null;
  serverEndpoint?: string | null;
  allowedIps?: string[];
  publicKey?: string | null;
  bytesReceived?: number;
  bytesSent?: number;
  userRole?: RoleName;
  activeProviderName: string;
  lang?: UiLang;
  isDark?: boolean;
}

function formatTopologyBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function NetworkTopology({
  isConnected,
  assignedIp,
  serverEndpoint,
  allowedIps,
  publicKey,
  bytesReceived,
  bytesSent,
  userRole,
  activeProviderName,
  lang = 'th',
  isDark = true,
}: NetworkTopologyProps) {
  const t = getThemeClasses(isDark);
  const [selectedNode, setSelectedNode] = useState<TopologyNodeId | null>(null);

  const primarySubnet =
    allowedIps?.[0] ?? (userRole === 'STAFF' ? '10.20.0.0/16' : '10.30.1.0/24');
  const displaySubnets =
    allowedIps && allowedIps.length > 0
      ? allowedIps
      : ['10.13.13.0/24', userRole === 'STAFF' ? '10.20.0.0/16' : '10.30.1.0/24'];

  const toggleNode = (id: TopologyNodeId) => {
    setSelectedNode((prev) => (prev === id ? null : id));
  };

  const nodeCardClass = (id: TopologyNodeId) => {
    const isSelected = selectedNode === id;
    if (isSelected) {
      return isDark
        ? 'border-amber-400/60 bg-emerald-500/10 shadow-lg shadow-amber-500/10'
        : 'border-amber-500 bg-amber-50 shadow-md shadow-amber-500/10';
    }
    if (isConnected) {
      return isDark
        ? 'border-emerald-500/25 bg-slate-950/85 hover:border-emerald-400/50'
        : 'border-emerald-300 bg-emerald-50/60 hover:border-emerald-500';
    }
    return isDark
      ? 'border-white/5 bg-slate-950/60 hover:border-white/20'
      : 'border-stone-200 bg-stone-50 hover:border-stone-300';
  };

  return (
    <div className={`pt-6 border-t space-y-4 ${t.border}`}>
      <div className={`flex items-center justify-between text-[11px] ${t.muted}`}>
        <span className="font-medium flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-emerald-400" />
          {lang === 'th'
            ? 'แผนผังเส้นทางเครือข่าย (คลิกที่แต่ละจุดเพื่อดูรายละเอียด)'
            : 'Interactive Network Topology (click any node to inspect)'}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-full border ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
              : t.pillMuted
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'
            }`}
          />
          {isConnected ? 'TUNNEL ACTIVE' : 'STANDBY'}
        </span>
      </div>

      {/* 3-Hop Interactive Topology Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-11 items-center gap-2 text-xs">
        {/* Node 1: User Device */}
        <button
          type="button"
          aria-pressed={selectedNode === 'client'}
          aria-label="Inspect client node"
          onClick={() => toggleNode('client')}
          className={`sm:col-span-3 rounded-2xl border p-4 text-center transition-all cursor-pointer ${nodeCardClass('client')}`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Laptop className={`h-3.5 w-3.5 ${isConnected ? 'text-emerald-500' : t.muted}`} />
            <span className={`text-[11px] font-medium ${t.muted}`}>
              {lang === 'th' ? 'เครื่องของคุณ' : 'Your Device'}
            </span>
          </div>
          <span className={`font-mono font-bold text-sm block ${t.heading}`}>
            {assignedIp ? `IP: ${assignedIp}` : '10.13.13.2'}
          </span>
        </button>

        {/* Connector 1 */}
        <div className="hidden sm:flex sm:col-span-1 flex-col items-center justify-center gap-1">
          <div className="relative w-full flex items-center">
            <div
              className={`h-0.5 w-full rounded transition-all ${
                isConnected
                  ? 'bg-gradient-to-r from-emerald-500/70 via-emerald-400 to-emerald-500/70 shadow-sm shadow-emerald-400/50'
                  : isDark
                    ? 'bg-stone-800 border-t border-dashed border-stone-700'
                    : 'bg-stone-300 border-t border-dashed border-stone-400'
              }`}
            />
            {isConnected && (
              <span className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <ArrowRight className={`h-3 w-3 ${isConnected ? 'text-emerald-500' : 'text-stone-500'}`} />
        </div>

        {/* Node 2: VPN Gateway */}
        <button
          type="button"
          aria-pressed={selectedNode === 'gateway'}
          aria-label="Inspect gateway node"
          onClick={() => toggleNode('gateway')}
          className={`sm:col-span-3 rounded-2xl border p-4 text-center transition-all cursor-pointer ${nodeCardClass('gateway')}`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Shield className={`h-3.5 w-3.5 ${isConnected ? 'text-amber-500' : t.muted}`} />
            <span className={`text-[11px] font-medium ${t.muted}`}>
              VPN Gateway ({activeProviderName})
            </span>
          </div>
          <span className={`font-mono font-bold text-xs block ${t.text}`}>
            {serverEndpoint ?? '127.0.0.1:51820'}
          </span>
        </button>

        {/* Connector 2 */}
        <div className="hidden sm:flex sm:col-span-1 flex-col items-center justify-center gap-1">
          <div className="relative w-full flex items-center">
            <div
              className={`h-0.5 w-full rounded transition-all ${
                isConnected
                  ? 'bg-gradient-to-r from-emerald-500/70 via-amber-400 to-emerald-500/70 shadow-sm shadow-emerald-400/50'
                  : isDark
                    ? 'bg-stone-800 border-t border-dashed border-stone-700'
                    : 'bg-stone-300 border-t border-dashed border-stone-400'
              }`}
            />
            {isConnected && (
              <span className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <ArrowRight className={`h-3 w-3 ${isConnected ? 'text-amber-500' : 'text-stone-500'}`} />
        </div>

        {/* Node 3: Company Network */}
        <button
          type="button"
          aria-pressed={selectedNode === 'network'}
          aria-label="Inspect network node"
          onClick={() => toggleNode('network')}
          className={`sm:col-span-3 rounded-2xl border p-4 text-center transition-all cursor-pointer ${nodeCardClass('network')}`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Globe className={`h-3.5 w-3.5 ${isConnected ? 'text-emerald-500' : t.muted}`} />
            <span className={`text-[11px] font-medium ${t.muted}`}>
              {lang === 'th' ? 'เครือข่ายองค์กร' : 'Corporate Network'}
            </span>
          </div>
          <span className={`font-mono font-bold text-xs block ${t.text}`}>
            {`Subnet: ${primarySubnet}`}
          </span>
        </button>
      </div>

      {/* Interactive Node Inspector Drawer */}
      {selectedNode && (
        <div
          role="region"
          aria-label="Topology node details"
          className={`rounded-2xl border border-amber-500/25 p-4 text-xs space-y-3 ${t.subCard}`}
        >
          <div className={`flex items-center justify-between border-b pb-2 ${t.border}`}>
            <span className="font-bold text-amber-500 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {selectedNode === 'client' &&
                (lang === 'th'
                  ? 'รายละเอียดจุดเชื่อมต่อฝั่งเครื่องผู้ใช้ (Client Endpoint)'
                  : 'Client Endpoint Details')}
              {selectedNode === 'gateway' &&
                (lang === 'th'
                  ? `รายละเอียดเกตเวย์ (${activeProviderName})`
                  : `Gateway Details (${activeProviderName})`)}
              {selectedNode === 'network' &&
                (lang === 'th'
                  ? 'เครือข่ายองค์กรที่ได้รับอนุญาต (Permitted Subnets)'
                  : 'Permitted Corporate Subnets')}
            </span>
            <button
              type="button"
              aria-label="Close node details"
              onClick={() => setSelectedNode(null)}
              className={`rounded-lg p-1 ${t.muted} hover:bg-white/5`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {selectedNode === 'client' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className={`block text-[11px] ${t.muted}`}>VPN IP Address</span>
                <span className={`font-mono font-semibold ${t.heading}`}>{assignedIp ?? 'Not assigned'}</span>
              </div>
              <div>
                <span className={`block text-[11px] ${t.muted}`}>Active Role</span>
                <span className="font-mono font-semibold text-amber-500">{userRole ?? 'STAFF'}</span>
              </div>
              <div>
                <span className={`block text-[11px] ${t.muted}`}>Live Traffic</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-emerald-500 inline-flex items-center gap-0.5">
                    <ArrowDown className="h-3 w-3" />
                    {formatTopologyBytes(bytesReceived)}
                  </span>
                  <span className="text-blue-500 inline-flex items-center gap-0.5">
                    <ArrowUp className="h-3 w-3" />
                    {formatTopologyBytes(bytesSent)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {selectedNode === 'gateway' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className={`block text-[11px] ${t.muted}`}>Gateway Endpoint</span>
                <span className={`font-mono font-semibold ${t.heading}`}>
                  {serverEndpoint ?? '127.0.0.1:51820'}
                </span>
              </div>
              <div>
                <span className={`block text-[11px] ${t.muted}`}>Cipher / Key</span>
                <span className={`font-mono ${t.text}`}>
                  {publicKey ? `X25519 (${publicKey.slice(0, 10)}...)` : 'Curve25519'}
                </span>
              </div>
              <div>
                <span className={`block text-[11px] ${t.muted}`}>Tunnel State</span>
                <span className={`font-mono font-bold ${isConnected ? 'text-emerald-500' : t.muted}`}>
                  {isConnected ? 'CONNECTED (Zero-Trust)' : 'DISCONNECTED'}
                </span>
              </div>
            </div>
          )}

          {selectedNode === 'network' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {displaySubnets.map((cidr) => (
                  <span
                    key={cidr}
                    className="font-mono text-[11px] rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-500"
                  >
                    {cidr}
                  </span>
                ))}
              </div>
              <p className={`text-[11px] ${t.muted}`}>
                {lang === 'th'
                  ? `การเข้าถึงถูกควบคุมด้วยนโยบาย Deny-by-Default ตามบทบาท ${userRole ?? 'STAFF'}`
                  : `Access enforced by Deny-by-Default policy for role ${userRole ?? 'STAFF'}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
