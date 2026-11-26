import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DeviceStatus, type DeviceDto } from '@mango/shared';
import {
  ChevronDown,
  Clock,
  Copy,
  Download,
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
import { downloadCsv } from '../lib/csv';
import { getThemeClasses, type UiLang } from '../lib/theme';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface DevicesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
  lang?: UiLang;
  isDark?: boolean;
}

function exportDevicesToCsv(devicesToExport: DeviceDto[]) {
  const headers = ['Device ID', 'Hostname', 'Username', 'User ID', 'Status', 'Fingerprint', 'Last Seen'];
  const rows = devicesToExport.map((d) => [
    d.id,
    d.hostname,
    d.username ?? '',
    d.userId,
    d.status,
    d.fingerprint,
    d.lastSeenAt ? new Date(d.lastSeenAt).toISOString() : '',
  ]);
  downloadCsv(`mango-vpn-devices-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
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
  return { icon: Monitor, label: 'Windows / PC', colorClass: 'text-emerald-400 bg-emerald-500/10 border-amber-500/20' };
}

function formatDeviceDate(iso: string | null, lang: UiLang = 'th'): string {
  if (!iso) return lang === 'th' ? 'ยังไม่เคยเชื่อมต่อ' : 'Never connected';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function DevicesTab({ apiBaseUrl, accessToken, auth, lang = 'th', isDark = true }: DevicesTabProps) {
  const t = getThemeClasses(isDark);
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
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl border px-5 py-4 ${t.card}`}>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium ${t.pillMuted}`}>
            <Monitor className="h-3.5 w-3.5 text-emerald-400" />
            {lang === 'th' ? `ทั้งหมด ${devices.length} เครื่อง` : `Total ${devices.length} Devices`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 font-medium text-emerald-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            {lang === 'th' ? `ใช้งานอยู่ ${activeCount}` : `Active ${activeCount}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 font-medium text-rose-500">
            <ShieldAlert className="h-3.5 w-3.5" />
            {lang === 'th' ? `เพิกถอนแล้ว ${revokedCount}` : `Revoked ${revokedCount}`}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium hover:border-emerald-500/40 hover:text-emerald-400 transition-colors disabled:opacity-50 ${t.secondaryBtn}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listQuery.isFetching ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{lang === 'th' ? 'รีเฟรช' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            aria-label="Export Devices CSV"
            onClick={() => {
              exportDevicesToCsv(filteredDevices);
              showToast({
                type: 'success',
                title: 'Devices Exported',
                message: `Exported ${filteredDevices.length} device records to CSV.`,
              });
            }}
            disabled={filteredDevices.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar matching Reference UI */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'th' ? 'ค้นหาชื่อเครื่อง ผู้ใช้ หรือ Fingerprint' : 'Search hostname, user, or fingerprint...'}
            aria-label="Search devices"
            className={`w-full h-12 rounded-2xl border px-5 pr-10 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors ${t.input}`}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
              className={`absolute right-3.5 top-3.5 p-0.5 rounded-full ${t.muted}`}
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
            className={`w-full h-12 rounded-2xl border px-5 pr-10 text-xs sm:text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors appearance-none cursor-pointer ${t.input}`}
          >
            <option value="ALL">{lang === 'th' ? 'ทุกสถานะ' : 'All Statuses'}</option>
            <option value={DeviceStatus.ACTIVE}>{lang === 'th' ? 'ใช้งานอยู่' : 'Active'}</option>
            <option value={DeviceStatus.REVOKED}>{lang === 'th' ? 'เพิกถอนแล้ว' : 'Revoked'}</option>
          </select>
          <ChevronDown className={`absolute right-4 top-4 h-4 w-4 pointer-events-none ${t.muted}`} />
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className={`text-sm ${t.muted}`}>{lang === 'th' ? 'กำลังโหลดข้อมูลอุปกรณ์...' : 'Loading devices...'}</p>
      ) : devices.length === 0 && !listQuery.error ? (
        <div className={`rounded-3xl border p-8 text-center text-sm ${t.card} ${t.muted}`}>
          {lang === 'th' ? 'ไม่พบอุปกรณ์ในระบบ' : 'No devices found.'}
          {lang === 'th' && <span className="sr-only">No devices found.</span>}
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className={`rounded-3xl border p-8 text-center text-sm space-y-2 ${t.card} ${t.muted}`}>
          <p>{lang === 'th' ? 'ไม่พบอุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา' : 'No devices match your search criteria.'}</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className="text-xs text-amber-500 hover:underline"
          >
            {lang === 'th' ? 'ล้างคำค้นหา' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className={`overflow-x-auto rounded-3xl border ${t.card}`}>
          <table className={`w-full text-left text-xs sm:text-sm ${t.text}`}>
            <thead className={`text-xs font-semibold ${t.tableHead}`}>
              <tr>
                <th className="px-6 py-4">{lang === 'th' ? 'อุปกรณ์' : 'Device'}</th>
                <th className="px-6 py-4">{lang === 'th' ? 'ผู้ใช้' : 'User'}</th>
                <th className="px-6 py-4">{lang === 'th' ? 'ใช้งานล่าสุด' : 'Last Seen'}</th>
                <th className="px-6 py-4">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                <th className="px-6 py-4 text-right">{lang === 'th' ? 'การทำงาน' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divide}`}>
              {filteredDevices.map((d) => {
                const meta = getDeviceMeta(d.hostname);
                const DeviceIcon = meta.icon;
                return (
                  <tr key={d.id} className={`transition-colors ${t.tableRow}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${meta.colorClass}`}>
                          <DeviceIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm tracking-tight ${t.heading}`}>{d.hostname}</span>
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${t.pillMuted}`}>
                              {meta.label}
                            </span>
                          </div>
                          <div className={`font-mono text-xs px-2 py-0.5 rounded border mt-1 inline-block ${t.subCard}`}>
                            {d.fingerprint.length > 16
                              ? `${d.fingerprint.slice(0, 4)}...${d.fingerprint.slice(-4)}`
                              : d.fingerprint}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-6 py-4 font-medium ${t.text}`}>
                      {d.username ?? d.userId}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className={`flex items-center gap-1.5 ${t.text}`}>
                        <Clock className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                        <span>{formatDeviceDate(d.lastSeenAt, lang)}</span>
                      </div>
                      <div className={`text-[11px] mt-0.5 ${t.muted}`}>
                        {lang === 'th' ? 'ลงทะเบียน: ' : 'Registered: '}
                        {formatDeviceDate(d.createdAt, lang)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-medium border ${
                          d.status === DeviceStatus.ACTIVE
                            ? isDark
                              ? 'bg-[#162a1e]/90 border-emerald-900/40 text-emerald-400'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : isDark
                              ? 'bg-[#2a1719]/90 border-rose-900/40 text-rose-400'
                              : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            d.status === DeviceStatus.ACTIVE ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-400'
                          }`}
                        />
                        <span>
                          {d.status === DeviceStatus.ACTIVE
                            ? (lang === 'th' ? 'ใช้งานอยู่' : 'Active')
                            : (lang === 'th' ? 'เพิกถอนแล้ว' : 'Revoked')}
                        </span>
                        <span className="sr-only">{d.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Inspect device"
                          onClick={() => setDeviceToInspect(d)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-medium hover:border-emerald-500/40 hover:text-emerald-400 transition-colors shadow-sm ${t.secondaryBtn}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>{lang === 'th' ? 'ดูรายละเอียด' : 'Inspect'}</span>
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
                          {lang === 'th' ? 'เพิกถอน' : 'Revoke'}
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
          <div className={`w-full max-w-lg rounded-3xl border p-6 shadow-2xl space-y-5 ${t.modal}`}>
            <div className={`flex items-start justify-between gap-4 border-b pb-4 ${t.border}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${getDeviceMeta(deviceToInspect.hostname).colorClass}`}>
                  {(() => {
                    const Icon = getDeviceMeta(deviceToInspect.hostname).icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div>
                  <h3 id="inspect-device-title" className={`text-base font-bold ${t.heading}`}>
                    {deviceToInspect.hostname}
                  </h3>
                  <p className={`text-xs ${t.muted}`}>
                    {getDeviceMeta(deviceToInspect.hostname).label} · {lang === 'th' ? 'ผู้ใช้: ' : 'Owner: '}
                    {deviceToInspect.username ?? deviceToInspect.userId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close inspect modal"
                onClick={() => setDeviceToInspect(null)}
                className={`rounded-xl p-1.5 transition-colors ${t.muted} hover:bg-white/5`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className={`rounded-2xl border p-3.5 space-y-1.5 ${t.subCard}`}>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${t.muted}`}>Full Device Fingerprint</span>
                  <button
                    type="button"
                    aria-label="Copy fingerprint"
                    onClick={() => void handleCopyFingerprint(deviceToInspect.fingerprint)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-amber-500/20 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{lang === 'th' ? 'คัดลอก' : 'Copy'}</span>
                  </button>
                </div>
                <p className={`font-mono break-all select-all ${t.text}`}>
                  {deviceToInspect.fingerprint}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`rounded-2xl border p-3.5 ${t.subCard}`}>
                  <span className={`block text-[11px] ${t.muted}`}>Device ID</span>
                  <span className={`font-mono break-all mt-1 block ${t.text}`}>{deviceToInspect.id}</span>
                </div>
                <div className={`rounded-2xl border p-3.5 ${t.subCard}`}>
                  <span className={`block text-[11px] ${t.muted}`}>
                    {lang === 'th' ? 'สถานะสิทธิ์ (Status)' : 'Status'}
                  </span>
                  <span className={`font-bold mt-1 block ${deviceToInspect.status === DeviceStatus.ACTIVE ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {deviceToInspect.status === DeviceStatus.ACTIVE
                      ? (lang === 'th' ? 'ACTIVE (ใช้งานอยู่)' : 'ACTIVE')
                      : (lang === 'th' ? 'REVOKED (เพิกถอนแล้ว)' : 'REVOKED')}
                  </span>
                </div>
                <div className={`rounded-2xl border p-3.5 ${t.subCard}`}>
                  <span className={`block text-[11px] ${t.muted}`}>
                    {lang === 'th' ? 'ลงทะเบียนเมื่อ (Created At)' : 'Created At'}
                  </span>
                  <span className={`mt-1 block ${t.text}`}>{formatDeviceDate(deviceToInspect.createdAt, lang)}</span>
                </div>
                <div className={`rounded-2xl border p-3.5 ${t.subCard}`}>
                  <span className={`block text-[11px] ${t.muted}`}>
                    {lang === 'th' ? 'ใช้งานล่าสุด (Last Seen)' : 'Last Seen'}
                  </span>
                  <span className={`mt-1 block ${t.text}`}>{formatDeviceDate(deviceToInspect.lastSeenAt, lang)}</span>
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 border-t pt-4 ${t.border}`}>
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
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors"
                >
                  {lang === 'th' ? 'เพิกถอนอุปกรณ์นี้' : 'Revoke Device'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDeviceToInspect(null)}
                className={`rounded-xl border px-5 py-2 text-xs font-semibold transition-colors ${t.secondaryBtn}`}
              >
                {lang === 'th' ? 'ปิดหน้าต่าง' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Device Revocation */}
      <ConfirmModal
        isOpen={deviceToRevoke !== null}
        isDark={isDark}
        title={lang === 'th' ? 'เพิกถอนสิทธิ์อุปกรณ์ (Revoke Device)' : 'Revoke Device Access'}
        message={
          <div className="space-y-2">
            <p>
              {lang === 'th' ? 'คุณต้องการเพิกถอนสิทธิ์อุปกรณ์ ' : 'Are you sure you want to permanently revoke device '}
              <strong className={t.heading}>{deviceToRevoke?.hostname}</strong>
              {lang === 'th' ? ' อย่างถาวรหรือไม่?' : '?'}
            </p>
            <p className={`font-mono text-xs ${t.muted}`}>
              Fingerprint: {deviceToInspect?.fingerprint ?? deviceToRevoke?.fingerprint}
            </p>
            <p className="text-xs text-rose-400 font-medium pt-1">
              {lang === 'th'
                ? '⚠️ ระบบจะตัดการเชื่อมต่อ WireGuard ที่กำลังใช้งานทันที และบล็อกการเชื่อมต่อใหม่จากเครื่องนี้'
                : '⚠️ This will immediately sever any active WireGuard VPN tunnels and block all future connection attempts from this device.'}
            </p>
          </div>
        }
        confirmLabel="Revoke Device"
        cancelLabel={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
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
