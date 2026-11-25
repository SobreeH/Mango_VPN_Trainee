import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert, Plus, Search, X, Filter } from 'lucide-react';
import {
  PolicyAction,
  PolicyProtocol,
  RoleName,
  type VpnPolicyDto,
} from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { createPolicy, deletePolicy, fetchPolicies } from '../lib/adminApi';
import { getThemeClasses, type UiLang } from '../lib/theme';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface PoliciesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
  lang?: UiLang;
  isDark?: boolean;
}

export function PoliciesTab({ apiBaseUrl, accessToken, auth, lang = 'th', isDark = true }: PoliciesTabProps) {
  const t = getThemeClasses(isDark);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleName>(RoleName.STAFF);
  const [targetCidr, setTargetCidr] = useState('');
  const [protocol, setProtocol] = useState<PolicyProtocol>(PolicyProtocol.ANY);
  const [portRange, setPortRange] = useState('');
  const [action, setAction] = useState<PolicyAction>(PolicyAction.ALLOW);
  const [priority, setPriority] = useState('100');
  const [pendingDeletePolicy, setPendingDeletePolicy] = useState<VpnPolicyDto | null>(null);

  // Quick Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | RoleName>('ALL');
  const [actionFilter, setActionFilter] = useState<'ALL' | PolicyAction>('ALL');

  const listQuery = useQuery({
    queryKey: ['policies', apiBaseUrl],
    queryFn: () => fetchPolicies(apiBaseUrl, accessToken, auth),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const parsedPriority = Number.parseInt(priority, 10);
      return createPolicy(
        apiBaseUrl,
        accessToken,
        {
          name,
          role,
          targetCidr,
          protocol,
          portRange: portRange.trim() ? portRange.trim() : null,
          action,
          priority: Number.isNaN(parsedPriority) ? 100 : parsedPriority,
        },
        auth,
      );
    },
    onSuccess: (newPolicy) => {
      showToast({
        type: 'success',
        title: 'Policy Created',
        message: `Zero-Trust policy "${newPolicy.name}" (${newPolicy.role} ${newPolicy.action}) added.`,
      });
      setName('');
      setTargetCidr('');
      setPortRange('');
      setPriority('100');
      void queryClient.invalidateQueries({ queryKey: ['policies', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Creation Failed',
        message: err instanceof Error ? err.message : 'Failed to create policy',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePolicy(apiBaseUrl, accessToken, id, auth),
    onSuccess: () => {
      showToast({
        type: 'warning',
        title: 'Policy Deleted',
        message: `Policy "${pendingDeletePolicy?.name ?? ''}" has been removed from firewall.`,
      });
      setPendingDeletePolicy(null);
      void queryClient.invalidateQueries({ queryKey: ['policies', apiBaseUrl] });
    },
    onError: (err) => {
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Failed to delete policy',
      });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const policies: VpnPolicyDto[] = listQuery.data?.items ?? [];
  const filteredPolicies = policies.filter((pol) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      term === '' ||
      pol.name.toLowerCase().includes(term) ||
      pol.targetCidr.toLowerCase().includes(term) ||
      (pol.portRange && pol.portRange.toLowerCase().includes(term)) ||
      pol.protocol.toLowerCase().includes(term);

    const matchesRole = roleFilter === 'ALL' || pol.role === roleFilter;
    const matchesAction = actionFilter === 'ALL' || pol.action === actionFilter;

    return matchesSearch && matchesRole && matchesAction;
  });
  const activeError = listQuery.error ?? createMutation.error ?? deleteMutation.error ?? null;

  return (
    <section aria-label="Policies" className="space-y-6">
      {/* Create Zero-Trust Policy Form Card */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-3xl border p-6 space-y-5 ${t.card}`}
      >
        <div className={`flex items-center gap-2.5 pb-2 border-b ${t.border}`}>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${t.heading}`}>
              {lang === 'th' ? 'สร้างนโยบายความปลอดภัย (Zero-Trust Policy)' : 'Create Zero-Trust Policy'}
            </h3>
            <p className={`text-[11px] ${t.muted}`}>
              {lang === 'th'
                ? 'กำหนดสิทธิ์การเข้าถึง Subnet และกฎการกรองแพ็กเก็ตตามบทบาท'
                : 'Define role-based subnet routing and firewall packet inspection rules'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="policy-name" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'ชื่อนโยบาย' : 'Policy Name'}
            </label>
            <input
              id="policy-name"
              aria-label="Policy Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Allow Core API"
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors ${t.input}`}
            />
          </div>

          <div>
            <label htmlFor="policy-role" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'บทบาท (Role)' : 'Role'}
            </label>
            <select
              id="policy-role"
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleName)}
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors cursor-pointer ${t.input}`}
            >
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-cidr" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'เครือข่ายปลายทาง (Target CIDR)' : 'Target CIDR'}
            </label>
            <input
              id="policy-cidr"
              aria-label="Target CIDR"
              type="text"
              required
              value={targetCidr}
              onChange={(e) => setTargetCidr(e.target.value)}
              placeholder="10.20.0.0/16"
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors font-mono ${t.input}`}
            />
          </div>

          <div>
            <label htmlFor="policy-protocol" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'โปรโตคอล (Protocol)' : 'Protocol'}
            </label>
            <select
              id="policy-protocol"
              aria-label="Protocol"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as PolicyProtocol)}
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors cursor-pointer ${t.input}`}
            >
              <option value={PolicyProtocol.ANY}>ANY</option>
              <option value={PolicyProtocol.TCP}>TCP</option>
              <option value={PolicyProtocol.UDP}>UDP</option>
              <option value={PolicyProtocol.ICMP}>ICMP</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-port-range" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'ช่วงพอร์ต (Port Range TCP/UDP)' : 'Port Range (TCP/UDP)'}
            </label>
            <input
              id="policy-port-range"
              aria-label="Port Range (TCP/UDP)"
              type="text"
              value={portRange}
              onChange={(e) => setPortRange(e.target.value)}
              placeholder="443 or 8000-8080"
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors font-mono ${t.input}`}
            />
          </div>

          <div>
            <label htmlFor="policy-action" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'การกระทำ (Action)' : 'Action'}
            </label>
            <select
              id="policy-action"
              aria-label="Action"
              value={action}
              onChange={(e) => setAction(e.target.value as PolicyAction)}
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors cursor-pointer ${t.input}`}
            >
              <option value={PolicyAction.ALLOW}>ALLOW</option>
              <option value={PolicyAction.DENY}>DENY</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-priority" className={`block text-xs font-medium mb-1.5 ${t.muted}`}>
              {lang === 'th' ? 'ลำดับความสำคัญ (Priority)' : 'Priority'}
            </label>
            <input
              id="policy-priority"
              aria-label="Priority"
              type="number"
              min={0}
              max={100000}
              required
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`w-full rounded-xl border px-4 py-2.5 text-xs sm:text-sm focus:outline-none transition-colors font-mono ${t.input}`}
            />
          </div>
        </div>

        <button
          type="submit"
          aria-label="Create Policy"
          disabled={createMutation.isPending}
          className="rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-6 py-2.5 text-xs sm:text-sm font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending
            ? (lang === 'th' ? 'กำลังสร้าง...' : 'Creating...')
            : (lang === 'th' ? 'สร้างนโยบาย' : 'Create Policy')}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-400 flex items-center gap-2 shadow-lg"
        >
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{activeError instanceof Error ? activeError.message : 'Policy request failed'}</span>
        </div>
      )}

      {/* Quick Search & Filter Bar */}
      {policies.length > 0 && (
        <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border p-4 sm:p-5 ${t.card}`}>
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
              <input
                type="text"
                aria-label="Search policies"
                placeholder={lang === 'th' ? 'ค้นหาชื่อนโยบาย, CIDR, พอร์ต...' : 'Search by name, CIDR, port...'}
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
              {filteredPolicies.length} / {policies.length} Policies
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-policy-role" className={`text-xs flex items-center gap-1 ${t.muted}`}>
                <Filter className="h-3 w-3 text-stone-500" />
                Role:
              </label>
              <select
                id="filter-policy-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'ALL' | RoleName)}
                className={`h-10 rounded-xl border px-3 text-xs focus:outline-none cursor-pointer ${t.input}`}
              >
                <option value="ALL">{lang === 'th' ? 'ทุกบทบาท' : 'All Roles'}</option>
                <option value={RoleName.ADMIN}>ADMIN</option>
                <option value={RoleName.STAFF}>STAFF</option>
                <option value={RoleName.CLIENT}>CLIENT</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-policy-action" className={`text-xs ${t.muted}`}>
                Action:
              </label>
              <select
                id="filter-policy-action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as 'ALL' | PolicyAction)}
                className={`h-10 rounded-xl border px-3 text-xs focus:outline-none cursor-pointer ${t.input}`}
              >
                <option value="ALL">{lang === 'th' ? 'ทุกกฎ' : 'All Actions'}</option>
                <option value={PolicyAction.ALLOW}>ALLOW</option>
                <option value={PolicyAction.DENY}>DENY</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <div className={`rounded-3xl border p-8 text-center text-xs ${t.card} ${t.muted}`}>
          {lang === 'th' ? 'กำลังโหลดนโยบาย...' : 'Loading policies...'}
        </div>
      ) : policies.length === 0 && !listQuery.error ? (
        <div className={`rounded-3xl border p-12 text-center text-xs space-y-2 ${t.card} ${t.muted}`}>
          <ShieldCheck className="h-8 w-8 text-stone-500 mx-auto" />
          <p className={`font-medium ${t.text}`}>
            {lang === 'th' ? 'ยังไม่มีนโยบายที่ตั้งค่าไว้' : 'No policies configured.'}
          </p>
          {lang === 'th' && <span className="sr-only">No policies configured.</span>}
          <p className={`text-[11px] ${t.muted}`}>
            {lang === 'th'
              ? 'นโยบายการเข้าถึงเครือข่าย Zero-Trust จะถูกแสดงที่นี่'
              : 'Zero-Trust subnet routing policies will be displayed here.'}
          </p>
        </div>
      ) : policies.length > 0 && filteredPolicies.length === 0 ? (
        <div className={`rounded-3xl border p-8 text-center text-xs space-y-3 ${t.card} ${t.muted}`}>
          <ShieldAlert className="h-7 w-7 text-stone-500 mx-auto" />
          <p className={`font-medium ${t.text}`}>
            {lang === 'th' ? 'ไม่พบนโยบายที่ตรงกับคำค้นหาหรือตัวกรอง' : 'No policies match your search or filters.'}
          </p>
          {lang === 'th' && <span className="sr-only">No policies match your search or filters.</span>}
          <button
            type="button"
            aria-label="Clear Filters"
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('ALL');
              setActionFilter('ALL');
            }}
            className={`rounded-xl border px-4 py-2 text-xs font-semibold text-amber-500 transition-colors ${t.secondaryBtn}`}
          >
            {lang === 'th' ? 'ล้างตัวกรอง' : 'Clear Filters'}
          </button>
        </div>
      ) : filteredPolicies.length > 0 ? (
        <div className="space-y-3">
          {filteredPolicies.map((pol) => (
            <div
              key={pol.id}
              className={`flex flex-wrap items-center justify-between gap-4 rounded-3xl border p-5 hover:border-amber-500/20 transition-all ${t.card}`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className={`font-bold text-sm tracking-tight ${t.heading}`}>{pol.name}</span>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                    {pol.role}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      pol.action === PolicyAction.ALLOW
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {pol.action}
                  </span>
                  <span className={`text-xs font-mono ${t.muted}`}>Priority {pol.priority}</span>
                </div>
                <div className={`text-xs font-mono flex items-center gap-2 ${t.muted}`}>
                  <span className={t.text}>{pol.targetCidr}</span>
                  <span>·</span>
                  <span className="text-amber-500">{pol.protocol}</span>
                  {pol.portRange ? <span>:{pol.portRange}</span> : null}
                </div>
              </div>

              <button
                type="button"
                aria-label="Delete"
                disabled={deleteMutation.isPending}
                onClick={() => setPendingDeletePolicy(pol)}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 transition-colors shadow-sm"
              >
                {lang === 'th' ? 'ลบกฎ' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmModal
        isOpen={pendingDeletePolicy !== null}
        isDark={isDark}
        title="Delete Security Policy"
        message={
          <div className={`space-y-2 ${t.text}`}>
            <p>
              Are you sure you want to delete policy{' '}
              <strong className="text-amber-500">{pendingDeletePolicy?.name}</strong> (
              {pendingDeletePolicy?.role} {pendingDeletePolicy?.action} {pendingDeletePolicy?.targetCidr}
              )? This rule will be immediately removed from the zero-trust firewall.
            </p>
          </div>
        }
        confirmLabel="Delete Policy"
        cancelLabel={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDeletePolicy) {
            deleteMutation.mutate(pendingDeletePolicy.id);
          }
        }}
        onCancel={() => setPendingDeletePolicy(null)}
      />
    </section>
  );
}
