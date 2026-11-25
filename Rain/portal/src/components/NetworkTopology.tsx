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
}: NetworkTopologyProps) {
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
      return 'border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-500/10';
    }
    if (isConnected) {
      return 'border-emerald-500/25 bg-[#141311]/85 hover:border-emerald-400/50';
    }
    return 'border-white/5 bg-[#141311]/70 hover:border-white/20';
  };

  return (
    <div className="pt-6 border-t border-white/5 space-y-4">
      <div className="flex items-center justify-between text-[11px] text-stone-400">
        <span className="font-medium flex items-center gap-1.5">
          <Lock className="h-3 w-3 text-amber-400" />
          แผนผังเส้นทางเครือข่าย (คลิกที่แต่ละจุดเพื่อดูรายละเอียด)
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-full border ${
            isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-white/5 border-white/10 text-stone-400'
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
            <Laptop className={`h-3.5 w-3.5 ${isConnected ? 'text-emerald-400' : 'text-stone-400'}`} />
            <span className="text-[11px] text-stone-400 font-medium">เครื่องของคุณ</span>
          </div>
          <span className="font-mono font-bold text-stone-200 text-sm block">
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
                  : 'bg-stone-800 border-t border-dashed border-stone-700'
              }`}
            />
            {isConnected && (
              <span className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
          <ArrowRight className={`h-3 w-3 ${isConnected ? 'text-emerald-400' : 'text-stone-600'}`} />
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
            <Shield className={`h-3.5 w-3.5 ${isConnected ? 'text-amber-400' : 'text-stone-400'}`} />
            <span className="text-[11px] text-stone-400 font-medium">
              VPN Gateway ({activeProviderName})
            </span>
          </div>
          <span className="font-mono font-bold text-stone-300 text-xs block">
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
                  : 'bg-stone-800 border-t border-dashed border-stone-700'
              }`}
            />
            {isConnected && (
              <span className="absolute left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <ArrowRight className={`h-3 w-3 ${isConnected ? 'text-amber-400' : 'text-stone-600'}`} />
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
            <Globe className={`h-3.5 w-3.5 ${isConnected ? 'text-emerald-400' : 'text-stone-400'}`} />
            <span className="text-[11px] text-stone-400 font-medium">เครือข่ายองค์กร</span>
          </div>
          <span className="font-mono font-bold text-stone-300 text-xs block">
            {`Subnet: ${primarySubnet}`}
          </span>
        </button>
      </div>

      {/* Interactive Node Inspector Drawer */}
      {selectedNode && (
        <div
          role="region"
          aria-label="Topology node details"
          className="rounded-2xl border border-amber-500/25 bg-[#141311]/90 p-4 text-xs space-y-3"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {selectedNode === 'client' && 'รายละเอียดจุดเชื่อมต่อฝั่งเครื่องผู้ใช้ (Client Endpoint)'}
              {selectedNode === 'gateway' && `รายละเอียดเกตเวย์ (${activeProviderName})`}
              {selectedNode === 'network' && 'เครือข่ายองค์กรที่ได้รับอนุญาต (Permitted Subnets)'}
            </span>
            <button
              type="button"
              aria-label="Close node details"
              onClick={() => setSelectedNode(null)}
              className="rounded-lg p-1 text-stone-400 hover:bg-white/5 hover:text-stone-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {selectedNode === 'client' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-stone-500 block text-[11px]">VPN IP Address</span>
                <span className="font-mono font-semibold text-stone-200">{assignedIp ?? 'Not assigned'}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Active Role</span>
                <span className="font-mono font-semibold text-amber-300">{userRole ?? 'STAFF'}</span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Live Traffic</span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-emerald-400 inline-flex items-center gap-0.5">
                    <ArrowDown className="h-3 w-3" />
                    {formatTopologyBytes(bytesReceived)}
                  </span>
                  <span className="text-blue-400 inline-flex items-center gap-0.5">
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
                <span className="text-stone-500 block text-[11px]">Gateway Endpoint</span>
                <span className="font-mono font-semibold text-stone-200">
                  {serverEndpoint ?? '127.0.0.1:51820'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Cipher / Key</span>
                <span className="font-mono text-stone-300">
                  {publicKey ? `X25519 (${publicKey.slice(0, 10)}...)` : 'Curve25519'}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block text-[11px]">Tunnel State</span>
                <span className={`font-mono font-bold ${isConnected ? 'text-emerald-400' : 'text-stone-400'}`}>
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
                    className="font-mono text-[11px] rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-emerald-300"
                  >
                    {cidr}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-stone-400">
                การเข้าถึงถูกควบคุมด้วยนโยบาย Deny-by-Default ตามบทบาท {userRole ?? 'STAFF'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
