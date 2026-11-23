import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeviceStatus, type DeviceDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { fetchDevices, revokeDevice } from '../lib/adminApi';
import { ConfirmModal } from './ConfirmModal';

interface DevicesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function DevicesTab({ apiBaseUrl, accessToken, auth }: DevicesTabProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-devices', apiBaseUrl] });
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
  });

  const devices: DeviceDto[] = listQuery.data?.items ?? [];
  const activeError = listQuery.error ?? revokeMutation.error ?? null;

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
    <section aria-label="Devices" className="space-y-5">
      {activeError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-950/50 p-3.5 text-xs sm:text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'Device request failed'}
        </div>
      )}

      {/* Filter and Search Bar matching Reference UI */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อเครื่องหรือผู้ใช้"
            aria-label="Search devices"
            className="w-full h-11 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | DeviceStatus)}
            aria-label="Filter status"
            className="w-full h-11 rounded-2xl border border-slate-700/80 bg-slate-900/80 px-4 text-xs sm:text-sm text-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-colors"
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value={DeviceStatus.ACTIVE}>ใช้งานอยู่</option>
            <option value={DeviceStatus.REVOKED}>เพิกถอนแล้ว</option>
          </select>
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading devices...</p>
      ) : devices.length === 0 && !listQuery.error ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
          No devices found.
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-400">
          ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-900/60 shadow-xl backdrop-blur-sm">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="border-b border-slate-800/80 bg-slate-900/90 text-slate-400 text-xs font-semibold">
              <tr>
                <th className="px-5 py-3.5">อุปกรณ์</th>
                <th className="px-5 py-3.5">ผู้ใช้</th>
                <th className="px-5 py-3.5">สถานะ</th>
                <th className="px-5 py-3.5 text-right">การทำงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredDevices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-bold text-slate-100 text-sm">{d.hostname}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                      {d.fingerprint.length > 16
                        ? `${d.fingerprint.slice(0, 4)}...${d.fingerprint.slice(-4)}`
                        : d.fingerprint}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300 font-medium">
                    {d.username ?? d.userId}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
                        d.status === DeviceStatus.ACTIVE
                          ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                          : 'bg-red-950/60 border-red-800/60 text-red-400'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          d.status === DeviceStatus.ACTIVE ? 'bg-emerald-400' : 'bg-red-400'
                        }`}
                      />
                      <span>{d.status === DeviceStatus.ACTIVE ? 'ใช้งานอยู่' : 'เพิกถอนแล้ว'}</span>
                      <span className="sr-only">{d.status}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
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
                      className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-900/50 hover:text-red-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                    >
                      เพิกถอน
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
