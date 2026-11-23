import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeviceStatus, type DeviceDto } from '@mango/shared';
import { X, ChevronDown } from 'lucide-react';
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
    <section aria-label="Devices" className="space-y-6">
      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/40 bg-red-950/50 p-4 text-xs sm:text-sm text-red-200"
        >
          {activeError instanceof Error ? activeError.message : 'Device request failed'}
        </div>
      )}

      {/* Filter and Search Bar matching Reference UI */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาชื่อเครื่องหรือผู้ใช้"
            aria-label="Search devices"
            className="w-full h-12 rounded-2xl border border-[#1c2838] bg-[#0c1524]/80 px-5 pr-10 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-[#007dfc] focus:ring-1 focus:ring-[#007dfc] focus:outline-none transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-3.5 p-0.5 rounded-full text-slate-400 hover:text-slate-200"
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
            className="w-full h-12 rounded-2xl border border-[#1c2838] bg-[#0c1524]/80 px-5 pr-10 text-xs sm:text-sm text-slate-200 focus:border-[#007dfc] focus:ring-1 focus:ring-[#007dfc] focus:outline-none transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">ทุกสถานะ</option>
            <option value={DeviceStatus.ACTIVE}>ใช้งานอยู่</option>
            <option value={DeviceStatus.REVOKED}>เพิกถอนแล้ว</option>
          </select>
          <ChevronDown className="absolute right-4 top-4 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading devices...</p>
      ) : devices.length === 0 && !listQuery.error ? (
        <div className="rounded-3xl border border-[#1c2838] bg-[#0c1524]/80 p-8 text-center text-sm text-slate-400">
          No devices found.
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="rounded-3xl border border-[#1c2838] bg-[#0c1524]/80 p-8 text-center text-sm text-slate-400 space-y-2">
          <p>ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="text-xs text-[#007dfc] hover:underline"
          >
            ล้างคำค้นหา
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[#1c2838] bg-[#0c1524]/85 shadow-2xl backdrop-blur-xl">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="border-b border-[#1c2838] text-slate-400 text-xs font-semibold">
              <tr>
                <th className="px-6 py-4">อุปกรณ์</th>
                <th className="px-6 py-4">ผู้ใช้</th>
                <th className="px-6 py-4">สถานะ</th>
                <th className="px-6 py-4 text-right">การทำงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2838]">
              {filteredDevices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-bold text-slate-100 text-sm tracking-tight">{d.hostname}</div>
                      <div className="font-mono text-xs text-slate-400 bg-[#080e18] px-2 py-0.5 rounded border border-[#1c2838] mt-1 inline-block">
                        {d.fingerprint.length > 16
                          ? `${d.fingerprint.slice(0, 4)}...${d.fingerprint.slice(-4)}`
                          : d.fingerprint}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300 font-medium">
                    {d.username ?? d.userId}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-medium border ${
                        d.status === DeviceStatus.ACTIVE
                          ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                          : 'bg-rose-950/60 border-rose-900/60 text-rose-400'
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
                      className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-5 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-900/60 hover:text-rose-100 transition-colors disabled:opacity-35 disabled:cursor-not-allowed shadow-sm"
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
