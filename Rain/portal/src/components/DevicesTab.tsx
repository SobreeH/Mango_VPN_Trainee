import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeviceStatus, type DeviceDto } from '@mango/shared';
import {
  ChevronDown,
  Clock,
  Copy,
  Eye,
  Laptop,
  Monitor,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { AuthRefreshContext } from '../api/auth';
import { fetchDevices, revokeDevice } from '../lib/adminApi';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface DevicesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

function getDeviceMeta(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower.includes('mac') || lower.includes('darwin') || lower.includes('apple')) {
    return { icon: Laptop, label: 'macOS', colorClass: 'text-stone-300 bg-white/5 border-white/10' };
  }
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian') || lower.includes('srv') || lower.includes('server')) {
    return { icon: Server, label: 'Linux / Server', colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
  }
  if (lower.includes('iphone') || lower.includes('android') || lower.includes('mobile')) {
    return { icon: Smartphone, label: 'Mobile', colorClass: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
  }
  return { icon: Monitor, label: 'Windows / PC', colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
}

function formatDeviceDate(iso: string | null): string {
  if (!iso) return 'ยังไม่เคยเชื่อมต่อ';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function DevicesTab({ apiBaseUrl, accessToken, auth }: DevicesTabProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [deviceToInspect, setDeviceToInspect] = useState<DeviceDto | null>(null);
  const [deviceToRevoke, setDeviceToRevoke] = useState<{
    id: string;
    hostname: string;
    fingerprint: string;
  } | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-devices', apiBaseUrl],
    queryFn: () => fetchDevices(apiBaseUrl, accessToken, auth),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeDevice(apiBaseUrl, accessToken, id, auth),
    onSuccess: (revoked) => {
      showToast({
        type: 'warning',
        title: 'Device Revoked',
        message: `Device ${revoked.hostname} has been revoked. Active VPN keys invalidated.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-devices', apiBaseUrl] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Revocation Failed',
        message: err instanceof Error ? err.message : 'Failed to revoke device',
      });
    },
  });

  const devices: DeviceDto[] = listQuery.data?.items ?? [];
  const activeError = listQuery.error ?? revokeMutation.error ?? null;
  const activeCount = devices.filter((d) => d.status === DeviceStatus.ACTIVE).length;
  const revokedCount = devices.filter((d) => d.status === DeviceStatus.REVOKED).length;

  const handleCopyFingerprint = async (fingerprint: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fingerprint);
      }
      showToast({
        type: 'success',
        title: 'Copied Fingerprint',
        message: 'คัดลอก Device Fingerprint ลงคลิปบอร์ดแล้ว',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Copy Failed',
        message: 'ไม่สามารถคัดลอกลงคลิปบอร์ดได้ กรุณาคัดลอกด้วยตนเอง',
      });
    }
  };

  const filteredDevices = devices.filter((d) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      d.hostname.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
      (d.username && d.username.toLowerCase().includes(searchTerm.toLowerCase().trim())) ||
      d.fingerprint.toLowerCase().includes(searchTerm.toLowerCase().trim());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <section aria-label="Devices" className="space-y-6">
      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-xs sm:text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'Device request failed'}
        </div>
      )}

      {/* Device Summary Strip & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/5 bg-[#1e1d1a]/85 px-5 py-4 shadow-xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 font-medium text-stone-200">
            <Monitor className="h-3.5 w-3.5 text-amber-400" />
            ทั้งหมด {devices.length} เครื่อง
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 font-medium text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            ใช้งานอยู่ {activeCount}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 font-medium text-rose-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            เพิกถอนแล้ว {revokedCount}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void listQuery.refetch()}
          disabled={listQuery.isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#262420] px-3.5 py-2 text-xs font-medium text-stone-200 hover:border-amber-500/40 hover:text-amber-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${listQuery.isFetching ? 'animate-spin text-amber-400' : ''}`} />
          <span>รีเฟรช</span>
        </button>
      </div>

      {/* Filter and Search Bar matching Reference UI */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อเครื่อง ผู้ใช้ หรือ Fingerprint"
            aria-label="Search devices"
            className="w-full h-12 rounded-2xl border border-white/5 bg-[#262420]/70 px-5 pr-10 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-3.5 p-0.5 rounded-full text-stone-400 hover:text-stone-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="w-full sm:w-52 relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | DeviceStatus)}
            aria-label="Filter status"
            className="w-full h-12 rounded-2xl border border-white/5 bg-[#262420]/70 px-5 pr-10 text-xs sm:text-sm text-stone-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value={DeviceStatus.ACTIVE}>ใช้งานอยู่</option>
            <option value={DeviceStatus.REVOKED}>เพิกถอนแล้ว</option>
          </select>
          <ChevronDown className="absolute right-4 top-4 h-4 w-4 text-stone-400 pointer-events-none" />
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-stone-400">Loading devices...</p>
      ) : devices.length === 0 && !listQuery.error ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/80 p-8 text-center text-sm text-stone-400">
          No devices found.
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/80 p-8 text-center text-sm text-stone-400 space-y-2">
          <p>ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="text-xs text-amber-400 hover:underline"
          >
            ล้างคำค้นหา
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/5 bg-[#1e1d1a]/80 shadow-2xl backdrop-blur-xl">
          <table className="w-full text-left text-xs sm:text-sm text-stone-300">
            <thead className="border-b border-white/5 text-stone-400 text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">อุปกรณ์</th>
                <th className="px-6 py-4">ผู้ใช้</th>
                <th className="px-6 py-4">ใช้งานล่าสุด</th>
                <th className="px-6 py-4">สถานะ</th>
                <th className="px-6 py-4 text-right">การทำงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredDevices.map((d) => {
                const meta = getDeviceMeta(d.hostname);
                const DeviceIcon = meta.icon;
                return (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.colorClass}`}>
                          <DeviceIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-100 text-sm tracking-tight">{d.hostname}</span>
                            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-stone-400 border border-white/5">
                              {meta.label}
                            </span>
                          </div>
                          <div className="font-mono text-xs text-stone-400 bg-[#141311] px-2 py-0.5 rounded border border-white/5 mt-1 inline-block">
                            {d.fingerprint.length > 16
                              ? `${d.fingerprint.slice(0, 4)}...${d.fingerprint.slice(-4)}`
                              : d.fingerprint}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-stone-300 font-medium">
                      {d.username ?? d.userId}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="flex items-center gap-1.5 text-stone-300">
                        <Clock className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                        <span>{formatDeviceDate(d.lastSeenAt)}</span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        ลงทะเบียน: {formatDeviceDate(d.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-medium border ${
                          d.status === DeviceStatus.ACTIVE
                            ? 'bg-[#162a1e]/90 border-emerald-900/40 text-emerald-400'
                            : 'bg-[#2a1719]/90 border-rose-900/40 text-rose-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            d.status === DeviceStatus.ACTIVE ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400'
                          }`}
                        />
                        <span>{d.status === DeviceStatus.ACTIVE ? 'ใช้งานอยู่' : 'เพิกถอนแล้ว'}</span>
                        <span className="sr-only">{d.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Inspect device"
                          onClick={() => setDeviceToInspect(d)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#262420] px-3.5 py-1.5 text-xs font-medium text-stone-200 hover:border-amber-500/40 hover:text-amber-300 transition-colors shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>ดูรายละเอียด</span>
                        </button>
                        <button
                          type="button"
                          aria-label="Revoke"
                          disabled={d.status === DeviceStatus.REVOKED || revokeMutation.isPending}
                          onClick={() =>
                            setDeviceToRevoke({
                              id: d.id,
                              hostname: d.hostname,
                              fingerprint: d.fingerprint,
                            })
                          }
                          className="rounded-xl border border-rose-900/50 bg-[#381a1c]/80 px-5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-900/60 hover:text-rose-100 transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-sm"
                        >
                          เพิกถอน
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Device Modal */}
      {deviceToInspect && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-device-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#1e1d1a] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${getDeviceMeta(deviceToInspect.hostname).colorClass}`}>
                  {(() => {
                    const Icon = getDeviceMeta(deviceToInspect.hostname).icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <h3 id="inspect-device-title" className="text-base font-bold text-stone-100">
                    {deviceToInspect.hostname}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {getDeviceMeta(deviceToInspect.hostname).label} · ผู้ใช้: {deviceToInspect.username ?? deviceToInspect.userId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close inspect modal"
                onClick={() => setDeviceToInspect(null)}
                className="rounded-xl p-1.5 text-stone-400 hover:bg-white/5 hover:text-stone-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-2xl border border-white/5 bg-[#141311]/80 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-stone-400 font-medium">Full Device Fingerprint</span>
                  <button
                    type="button"
                    aria-label="Copy fingerprint"
                    onClick={() => void handleCopyFingerprint(deviceToInspect.fingerprint)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                </div>
                <p className="font-mono text-stone-200 break-all select-all">
                  {deviceToInspect.fingerprint}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/5 bg-[#141311]/80 p-3.5">
                  <span className="text-stone-400 block text-[11px]">Device ID</span>
                  <span className="font-mono text-stone-200 break-all mt-1 block">{deviceToInspect.id}</span>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[#141311]/80 p-3.5">
                  <span className="text-stone-400 block text-[11px]">สถานะสิทธิ์ (Status)</span>
                  <span className={`font-bold mt-1 block ${deviceToInspect.status === DeviceStatus.ACTIVE ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deviceToInspect.status === DeviceStatus.ACTIVE ? 'ACTIVE (ใช้งานอยู่)' : 'REVOKED (เพิกถอนแล้ว)'}
                  </span>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[#141311]/80 p-3.5">
                  <span className="text-stone-400 block text-[11px]">ลงทะเบียนเมื่อ (Created At)</span>
                  <span className="text-stone-200 mt-1 block">{formatDeviceDate(deviceToInspect.createdAt)}</span>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[#141311]/80 p-3.5">
                  <span className="text-stone-400 block text-[11px]">ใช้งานล่าสุด (Last Seen)</span>
                  <span className="text-stone-200 mt-1 block">{formatDeviceDate(deviceToInspect.lastSeenAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-4">
              {deviceToInspect.status === DeviceStatus.ACTIVE && (
                <button
                  type="button"
                  onClick={() => {
                    const target = deviceToInspect;
                    setDeviceToInspect(null);
                    setDeviceToRevoke({
                      id: target.id,
                      hostname: target.hostname,
                      fingerprint: target.fingerprint,
                    });
                  }}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
                >
                  เพิกถอนอุปกรณ์นี้
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeviceToInspect(null)}
                className="rounded-xl border border-white/10 bg-[#262420] px-5 py-2 text-xs font-semibold text-stone-200 hover:bg-white/10 transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Device Revocation */}
      <ConfirmModal
        isOpen={deviceToRevoke !== null}
        title="Revoke Device Access"
        message={
          <div className="space-y-2">
            <p>
              Are you sure you want to permanently revoke device{' '}
              <strong className="text-slate-100">{deviceToRevoke?.hostname}</strong>?
            </p>
            <p className="font-mono text-xs text-slate-400">
              Fingerprint: {deviceToRevoke?.fingerprint}
            </p>
            <p className="text-xs text-red-400 font-medium pt-1">
              ⚠️ This will immediately sever any active WireGuard VPN tunnels and block all future
              connection attempts from this device.
            </p>
          </div>
        }
        confirmLabel="Revoke Device"
        confirmVariant="danger"
        isLoading={revokeMutation.isPending}
        onConfirm={() => {
          if (deviceToRevoke) {
            revokeMutation.mutate(deviceToRevoke.id, {
              onSettled: () => setDeviceToRevoke(null),
            });
          }
        }}
        onCancel={() => setDeviceToRevoke(null)}
      />
    </section>
  );
}
