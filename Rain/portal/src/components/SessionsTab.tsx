import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Download, Filter, PowerOff, RefreshCw, Search, ShieldAlert, Wifi, X } from 'lucide-react';
import { SessionStatus, VpnProviderType, type VpnSessionDto } from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { disconnectAllSessions, disconnectSession, fetchSessions } from '../lib/adminApi';
import { getThemeClasses, type UiLang } from '../lib/theme';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface SessionsTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
  lang?: UiLang;
  isDark?: boolean;
}

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function exportSessionsToCsv(sessionsToExport: VpnSessionDto[]) {
  const headers = ['Session ID', 'Username', 'User ID', 'Hostname', 'Device ID', 'Assigned IP', 'Status', 'Connected At'];
  const rows = sessionsToExport.map((s) => [
    s.id,
    s.username ?? '',
    s.userId ?? '',
    s.hostname ?? '',
    s.deviceId ?? '',
    s.assignedIp,
    s.status,
    s.connectedAt ? new Date(s.connectedAt).toISOString() : '',
  ]);

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mango-vpn-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SessionsTab({ apiBaseUrl, accessToken, auth, lang = 'th', isDark = true }: SessionsTabProps) {
  const t = getThemeClasses(isDark);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SessionStatus>('ALL');
  const [confirmTerminateAll, setConfirmTerminateAll] = useState(false);
  const [sessionToDisconnect, setSessionToDisconnect] = useState<{
    id: string;
    username: string;
    assignedIp: string;
  } | null>(null);

  const listQuery = useQuery({
    queryKey: ['admin-sessions', apiBaseUrl],
    queryFn: () => fetchSessions(apiBaseUrl, accessToken, auth),
  });

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => disconnectSession(apiBaseUrl, accessToken, id, auth),
    onSuccess: () => {
      showToast({
        type: 'warning',
        title: 'Session Disconnected',
        message: `Terminated VPN connection for ${sessionToDisconnect?.username ?? 'peer'}.`,
      });
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Disconnect Failed',
        message: err instanceof Error ? err.message : 'Failed to disconnect session',
      });
    },
  });

  const disconnectAllMutation = useMutation({
    mutationFn: () => disconnectAllSessions(apiBaseUrl, accessToken, auth),
    onSuccess: (res) => {
      showToast({
        type: 'warning',
        title: 'All Active Sessions Terminated',
        message: `Disconnected ${res.disconnectedCount} active VPN session(s) across gateways.`,
      });
      setConfirmTerminateAll(false);
      void queryClient.invalidateQueries({ queryKey: ['admin-sessions', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Mass Termination Failed',
        message: err instanceof Error ? err.message : 'Failed to disconnect all sessions',
      });
      setConfirmTerminateAll(false);
    },
  });

  const sessions: VpnSessionDto[] = listQuery.data?.items ?? [];
  const activeSessionsCount = sessions.filter((s) => s.status === SessionStatus.ACTIVE).length;
  const activeError =
    listQuery.error ?? disconnectMutation.error ?? disconnectAllMutation.error ?? null;

  const filteredSessions = sessions.filter((s) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      term === '' ||
      (s.username && s.username.toLowerCase().includes(term)) ||
      s.userId.toLowerCase().includes(term) ||
      (s.hostname && s.hostname.toLowerCase().includes(term)) ||
      s.assignedIp.toLowerCase().includes(term) ||
      (s.gatewayName && s.gatewayName.toLowerCase().includes(term)) ||
      (s.providerType && s.providerType.toLowerCase().includes(term));

    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <section aria-label="Sessions" className="space-y-6">
      {/* Header Card with Export CSV & Emergency Terminate All */}
      <div className={`rounded-3xl border p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${t.card}`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`text-sm font-bold ${t.heading}`}>
                {lang === 'th' ? 'เซสชัน VPN ที่ใช้งานอยู่และประวัติ' : 'Active & Historical VPN Sessions'}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-emerald-500">
                {activeSessionsCount > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {activeSessionsCount} Active
              </span>
            </div>
            <p className={`text-[11px] ${t.muted}`}>
              {lang === 'th'
                ? 'ติดตามอุโมงค์เชื่อมต่อที่เข้ารหัสและไอพี IPAM แบบเรียลไทม์'
                : 'Live WireGuard cryptographic tunnels and real-time IPAM tracking'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void listQuery.refetch()}
            disabled={listQuery.isFetching}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium hover:border-amber-500/40 hover:text-amber-400 transition-colors disabled:opacity-50 ${t.secondaryBtn}`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listQuery.isFetching ? 'animate-spin text-amber-400' : ''}`} />
            <span>{lang === 'th' ? 'รีเฟรช' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              exportSessionsToCsv(filteredSessions);
              showToast({
                type: 'success',
                title: 'Report Downloaded',
                message: `Exported ${filteredSessions.length} VPN session records to CSV.`,
              });
            }}
            disabled={filteredSessions.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-4 py-2 text-xs font-semibold shadow-sm transition-all disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{lang === 'th' ? 'ส่งออก CSV' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            aria-label="Terminate All Active"
            disabled={activeSessionsCount === 0 || disconnectAllMutation.isPending}
            onClick={() => setConfirmTerminateAll(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 px-4 py-2 text-xs font-bold shadow-sm transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          >
            <PowerOff className="h-3.5 w-3.5 text-rose-400" />
            <span>{lang === 'th' ? 'ตัดการเชื่อมต่อทั้งหมด' : 'Terminate All Active'}</span>
          </button>
        </div>
      </div>

      {/* Quick Search & Status Filter Bar */}
      {sessions.length > 0 && (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border p-4 sm:p-5 ${t.card}`}>
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
              <input
                type="text"
                aria-label="Search sessions"
                placeholder={lang === 'th' ? 'ค้นหาชื่อผู้ใช้ อุปกรณ์ หรือ IP...' : 'Search by user, device, IP...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full h-10 rounded-xl border pl-9 pr-8 text-xs focus:outline-none transition-colors ${t.input}`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${t.muted}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg border whitespace-nowrap ${t.pillMuted}`}>
              {filteredSessions.length} / {sessions.length} Sessions
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-session-status" className={`text-xs flex items-center gap-1 ${t.muted}`}>
              <Filter className="h-3 w-3 text-stone-500" />
              {lang === 'th' ? 'สถานะ:' : 'Status:'}
            </label>
            <select
              id="filter-session-status"
              aria-label="Filter session status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SessionStatus)}
              className={`h-10 rounded-xl border px-3 text-xs focus:outline-none cursor-pointer ${t.input}`}
            >
              <option value="ALL">{lang === 'th' ? 'ทุกสถานะ' : 'All Statuses'}</option>
              <option value={SessionStatus.ACTIVE}>ACTIVE</option>
              <option value={SessionStatus.DISCONNECTED}>DISCONNECTED</option>
              <option value={SessionStatus.EXPIRED}>EXPIRED</option>
            </select>
          </div>
        </div>
      )}

      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-400 flex items-center gap-2 shadow-lg"
        >
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{activeError instanceof Error ? activeError.message : 'Session request failed'}</span>
        </div>
      )}

      {listQuery.isLoading ? (
        <div className={`rounded-3xl border p-8 text-center text-xs ${t.card} ${t.muted}`}>
          {lang === 'th' ? 'กำลังโหลดข้อมูลเซสชัน VPN...' : 'Loading VPN sessions...'}
        </div>
      ) : sessions.length === 0 && !listQuery.error ? (
        <div className={`rounded-3xl border p-12 text-center text-xs space-y-2 ${t.card} ${t.muted}`}>
          <Activity className="h-8 w-8 text-stone-500 mx-auto" />
          <p className={`font-medium ${t.text}`}>
            {lang === 'th' ? 'ยังไม่มีเซสชัน VPN ในระบบ' : 'No VPN sessions found.'}
          </p>
          {lang === 'th' && <span className="sr-only">No VPN sessions found.</span>}
          <p className={`text-[11px] ${t.muted}`}>
            {lang === 'th'
              ? 'เมื่อมีผู้ใช้เชื่อมต่อ VPN สถานะและ IP ที่ได้รับจะแสดงที่นี่แบบเรียลไทม์'
              : 'Connected peers and tunnel states will appear here in real-time.'}
          </p>
        </div>
      ) : sessions.length > 0 && filteredSessions.length === 0 ? (
        <div className={`rounded-3xl border p-8 text-center text-xs space-y-3 ${t.card} ${t.muted}`}>
          <ShieldAlert className="h-7 w-7 text-stone-500 mx-auto" />
          <p className={`font-medium ${t.text}`}>
            {lang === 'th' ? 'ไม่พบเซสชันที่ตรงกับเงื่อนไขการค้นหา' : 'No sessions match your search or filter.'}
          </p>
          {lang === 'th' && <span className="sr-only">No sessions match your search or filter.</span>}
          <button
            type="button"
            aria-label="Clear Filters"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
            }}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold text-amber-500 transition-colors ${t.secondaryBtn}`}
          >
            {lang === 'th' ? 'ล้างตัวกรอง' : 'Clear Filters'}
          </button>
        </div>
      ) : filteredSessions.length > 0 ? (
        <div className={`overflow-hidden rounded-3xl border ${t.card}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`text-[11px] uppercase tracking-wider ${t.tableHead}`}>
                <tr>
                  <th className="px-4 py-3.5">{lang === 'th' ? 'ผู้ใช้ / อุปกรณ์' : 'User / Device'}</th>
                  <th className="px-4 py-3.5">{lang === 'th' ? 'ผู้ให้บริการ / เกตเวย์' : 'Provider / Gateway'}</th>
                  <th className="px-4 py-3.5">{lang === 'th' ? 'ไอพีที่ได้รับ' : 'Assigned IP'}</th>
                  <th className="px-4 py-3.5">{lang === 'th' ? 'สถานะ' : 'Status'}</th>
                  <th className="px-4 py-3.5 text-right">{lang === 'th' ? 'การทำงาน' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${t.divide}`}>
                {filteredSessions.map((s) => {
                  const provider = s.providerType ?? VpnProviderType.WIREGUARD;
                  const providerBadgeClass =
                    provider === VpnProviderType.FORTINET
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : provider === VpnProviderType.CISCO
                        ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                        : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30';
                  return (
                    <tr key={s.id} className={`transition-colors ${t.tableRow}`}>
                      <td className="px-4 py-3.5">
                        <div className={`font-semibold ${t.text}`}>{s.username ?? s.userId}</div>
                        <div className={`text-[11px] font-mono ${t.muted}`}>{s.hostname ?? s.deviceId}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider ${providerBadgeClass}`}>
                          {provider}
                        </span>
                        {s.gatewayName && (
                          <div className={`text-[11px] mt-1 ${t.muted}`}>{s.gatewayName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-emerald-500 font-semibold">{s.assignedIp}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider border ${
                            s.status === SessionStatus.ACTIVE
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                              : t.pillMuted
                          }`}
                        >
                          {s.status === SessionStatus.ACTIVE && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          aria-label="Disconnect"
                          disabled={s.status !== SessionStatus.ACTIVE || disconnectMutation.isPending}
                          onClick={() =>
                            setSessionToDisconnect({
                              id: s.id,
                              username: s.username ?? s.userId,
                              assignedIp: s.assignedIp,
                            })
                          }
                          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-30 transition-colors shadow-sm"
                        >
                          {lang === 'th' ? 'ตัดการเชื่อมต่อ' : 'Disconnect'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Confirmation Modal for Disconnect Session */}
      <ConfirmModal
        isOpen={sessionToDisconnect !== null}
        isDark={isDark}
        title={lang === 'th' ? 'ตัดการเชื่อมต่อเซสชัน VPN' : 'Disconnect Active VPN Session'}
        message={
          <div className={`space-y-2 ${t.text}`}>
            <p>
              {lang === 'th'
                ? 'คุณแน่ใจหรือไม่ว่าต้องการบังคับตัดการเชื่อมต่อของ '
                : 'Are you sure you want to force disconnect the session for user '}
              <strong className="text-amber-500">{sessionToDisconnect?.username}</strong>?
            </p>
            <p className="font-mono text-xs text-emerald-500 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              Assigned IP: {sessionToDisconnect?.assignedIp}
            </p>
            <p className="text-xs text-amber-500 font-medium pt-1">
              {lang === 'th'
                ? '⚠️ ระบบจะถอด peer ออกจาก VPN Gateway ทันที ทำให้ผู้ใช้นี้หลุดจากการเชื่อมต่อเครือข่าย'
                : '⚠️ The VPN peer/session will be immediately removed from the gateway daemon, terminating active network access.'}
            </p>
          </div>
        }
        confirmLabel="Disconnect Session"
        cancelLabel={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmVariant="danger"
        isLoading={disconnectMutation.isPending}
        onConfirm={() => {
          if (sessionToDisconnect) {
            disconnectMutation.mutate(sessionToDisconnect.id, {
              onSettled: () => setSessionToDisconnect(null),
            });
          }
        }}
        onCancel={() => setSessionToDisconnect(null)}
      />

      {/* Confirmation Modal for Emergency Terminate All Active Sessions */}
      <ConfirmModal
        isOpen={confirmTerminateAll}
        isDark={isDark}
        title="Terminate All Active VPN Sessions"
        message={
          <div className={`space-y-2 ${t.text}`}>
            <p>
              {lang === 'th' ? 'คุณแน่ใจหรือไม่ว่าต้องการตัดการเชื่อมต่อที่กำลังออนไลน์อยู่ทั้งหมด ' : 'Are you sure you want to immediately terminate all '}
              <strong className="text-rose-500">
                {activeSessionsCount} {lang === 'th' ? 'เซสชัน' : 'active VPN session(s)'}
              </strong>
              ?
            </p>
            <p className="text-xs text-amber-500 font-medium pt-1">
              {lang === 'th'
                ? '⚠️ ผู้ใช้ทุกคนที่กำลังเชื่อมต่อ VPN อยู่ในขณะนี้จะถูกตัดการเชื่อมต่อพร้อมกันทันที'
                : '⚠️ All active peers across connected gateways will be torn down immediately, severing network access for all currently connected users.'}
            </p>
          </div>
        }
        confirmLabel="Terminate All Sessions"
        cancelLabel={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmVariant="danger"
        isLoading={disconnectAllMutation.isPending}
        onConfirm={() => disconnectAllMutation.mutate()}
        onCancel={() => setConfirmTerminateAll(false)}
      />
    </section>
  );
}
