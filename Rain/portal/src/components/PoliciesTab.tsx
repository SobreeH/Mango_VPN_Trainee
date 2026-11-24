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
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';

interface PoliciesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function PoliciesTab({ apiBaseUrl, accessToken, auth }: PoliciesTabProps) {
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
        className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-6 backdrop-blur-xl shadow-2xl space-y-5"
      >
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Plus className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-100">Create Zero-Trust Policy</h3>
            <p className="text-[11px] text-stone-400">Define role-based subnet routing and firewall packet inspection rules</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="policy-name" className="block text-xs font-medium text-stone-400 mb-1.5">
              Policy Name
            </label>
            <input
              id="policy-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Allow Core API"
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label htmlFor="policy-role" className="block text-xs font-medium text-stone-400 mb-1.5">
              Role
            </label>
            <select
              id="policy-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleName)}
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer"
            >
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-cidr" className="block text-xs font-medium text-stone-400 mb-1.5">
              Target CIDR
            </label>
            <input
              id="policy-cidr"
              type="text"
              required
              value={targetCidr}
              onChange={(e) => setTargetCidr(e.target.value)}
              placeholder="10.20.0.0/16"
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors font-mono"
            />
          </div>

          <div>
            <label htmlFor="policy-protocol" className="block text-xs font-medium text-stone-400 mb-1.5">
              Protocol
            </label>
            <select
              id="policy-protocol"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as PolicyProtocol)}
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer"
            >
              <option value={PolicyProtocol.ANY}>ANY</option>
              <option value={PolicyProtocol.TCP}>TCP</option>
              <option value={PolicyProtocol.UDP}>UDP</option>
              <option value={PolicyProtocol.ICMP}>ICMP</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-port-range" className="block text-xs font-medium text-stone-400 mb-1.5">
              Port Range (TCP/UDP)
            </label>
            <input
              id="policy-port-range"
              type="text"
              value={portRange}
              onChange={(e) => setPortRange(e.target.value)}
              placeholder="443 or 8000-8080"
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors font-mono"
            />
          </div>

          <div>
            <label htmlFor="policy-action" className="block text-xs font-medium text-stone-400 mb-1.5">
              Action
            </label>
            <select
              id="policy-action"
              value={action}
              onChange={(e) => setAction(e.target.value as PolicyAction)}
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer"
            >
              <option value={PolicyAction.ALLOW}>ALLOW</option>
              <option value={PolicyAction.DENY}>DENY</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-priority" className="block text-xs font-medium text-stone-400 mb-1.5">
              Priority
            </label>
            <input
              id="policy-priority"
              type="number"
              min={0}
              max={100000}
              required
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#262420]/70 px-4 py-2.5 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-xl bg-[#f59e0b] hover:bg-[#d97706] px-6 py-2.5 text-xs sm:text-sm font-bold text-stone-950 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Policy'}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-300 flex items-center gap-2 shadow-lg"
        >
          <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
          <span>{activeError instanceof Error ? activeError.message : 'Policy request failed'}</span>
        </div>
      )}

      {/* Quick Search & Filter Bar */}
      {policies.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-4 sm:p-5 shadow-xl backdrop-blur-xl">
          <div className="flex-1 flex items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
              <input
                type="text"
                aria-label="Search policies"
                placeholder="Search by name, CIDR, port..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 rounded-xl border border-white/10 bg-[#262420]/70 pl-9 pr-8 text-xs text-stone-100 placeholder-stone-500 focus:border-amber-400 focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] font-mono text-stone-400 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5 whitespace-nowrap">
              {filteredPolicies.length} / {policies.length} Policies
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="filter-policy-role" className="text-xs text-stone-400 flex items-center gap-1">
                <Filter className="h-3 w-3 text-stone-500" />
                Role:
              </label>
              <select
                id="filter-policy-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'ALL' | RoleName)}
                className="h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3 text-xs text-stone-100 focus:border-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                <option value={RoleName.ADMIN}>ADMIN</option>
                <option value={RoleName.STAFF}>STAFF</option>
                <option value={RoleName.CLIENT}>CLIENT</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-policy-action" className="text-xs text-stone-400">
                Action:
              </label>
              <select
                id="filter-policy-action"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as 'ALL' | PolicyAction)}
                className="h-10 rounded-xl border border-white/10 bg-[#262420]/70 px-3 text-xs text-stone-100 focus:border-amber-400 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Actions</option>
                <option value={PolicyAction.ALLOW}>ALLOW</option>
                <option value={PolicyAction.DENY}>DENY</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-8 text-center text-xs text-stone-400 shadow-xl">
          Loading policies...
        </div>
      ) : policies.length === 0 && !listQuery.error ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-12 text-center text-xs text-stone-400 shadow-xl space-y-2">
          <ShieldCheck className="h-8 w-8 text-stone-600 mx-auto" />
          <p className="text-stone-300 font-medium">No policies configured.</p>
          <p className="text-[11px] text-stone-500">Zero-Trust subnet routing policies will be displayed here.</p>
        </div>
      ) : policies.length > 0 && filteredPolicies.length === 0 ? (
        <div className="rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-8 text-center text-xs text-stone-400 shadow-xl space-y-3">
          <ShieldAlert className="h-7 w-7 text-stone-500 mx-auto" />
          <p className="text-stone-300 font-medium">No policies match your search or filters.</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setRoleFilter('ALL');
              setActionFilter('ALL');
            }}
            className="rounded-xl border border-white/10 bg-[#262420] px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-[#2e2a24] transition-colors"
          >
            Clear Filters
          </button>
        </div>
      ) : filteredPolicies.length > 0 ? (
        <div className="space-y-3">
          {filteredPolicies.map((pol) => (
            <div
              key={pol.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/5 bg-[#1e1d1a]/85 p-5 shadow-xl hover:border-amber-500/20 transition-all backdrop-blur-xl"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-bold text-stone-100 text-sm tracking-tight">{pol.name}</span>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
                    {pol.role}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      pol.action === PolicyAction.ALLOW
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {pol.action}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">Priority {pol.priority}</span>
                </div>
                <div className="text-xs font-mono text-stone-400 flex items-center gap-2">
                  <span className="text-stone-300">{pol.targetCidr}</span>
                  <span>·</span>
                  <span className="text-amber-400/80">{pol.protocol}</span>
                  {pol.portRange ? <span>:{pol.portRange}</span> : null}
                </div>
              </div>

              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setPendingDeletePolicy(pol)}
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmModal
        isOpen={pendingDeletePolicy !== null}
        title="Delete Security Policy"
        message={
          <div className="space-y-2 text-stone-300">
            <p>
              Are you sure you want to delete policy{' '}
              <strong className="text-amber-400">{pendingDeletePolicy?.name}</strong> (
              {pendingDeletePolicy?.role} {pendingDeletePolicy?.action} {pendingDeletePolicy?.targetCidr}
              )? This rule will be immediately removed from the zero-trust firewall.
            </p>
          </div>
        }
        confirmLabel="Delete Policy"
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
