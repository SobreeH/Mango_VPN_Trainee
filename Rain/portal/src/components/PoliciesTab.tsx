import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PolicyAction,
  PolicyProtocol,
  RoleName,
  type VpnPolicyDto,
} from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import { createPolicy, deletePolicy, fetchPolicies } from '../lib/adminApi';
import { ConfirmModal } from './ConfirmModal';

interface PoliciesTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

export function PoliciesTab({ apiBaseUrl, accessToken, auth }: PoliciesTabProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleName>(RoleName.STAFF);
  const [targetCidr, setTargetCidr] = useState('');
  const [protocol, setProtocol] = useState<PolicyProtocol>(PolicyProtocol.ANY);
  const [portRange, setPortRange] = useState('');
  const [action, setAction] = useState<PolicyAction>(PolicyAction.ALLOW);
  const [priority, setPriority] = useState('100');
  const [pendingDeletePolicy, setPendingDeletePolicy] = useState<VpnPolicyDto | null>(null);

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
    onSuccess: () => {
      setName('');
      setTargetCidr('');
      setPortRange('');
      setPriority('100');
      void queryClient.invalidateQueries({ queryKey: ['policies', apiBaseUrl] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePolicy(apiBaseUrl, accessToken, id, auth),
    onSuccess: () => {
      setPendingDeletePolicy(null);
      void queryClient.invalidateQueries({ queryKey: ['policies', apiBaseUrl] });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const policies: VpnPolicyDto[] = listQuery.data?.items ?? [];
  const activeError = listQuery.error ?? createMutation.error ?? deleteMutation.error ?? null;

  return (
    <section aria-label="Policies" className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-100">Create Zero-Trust Policy</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="policy-name" className="block text-xs text-slate-400 mb-1">
              Policy Name
            </label>
            <input
              id="policy-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Allow Core API"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="policy-role" className="block text-xs text-slate-400 mb-1">
              Role
            </label>
            <select
              id="policy-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleName)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value={RoleName.ADMIN}>ADMIN</option>
              <option value={RoleName.STAFF}>STAFF</option>
              <option value={RoleName.CLIENT}>CLIENT</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-cidr" className="block text-xs text-slate-400 mb-1">
              Target CIDR
            </label>
            <input
              id="policy-cidr"
              type="text"
              required
              value={targetCidr}
              onChange={(e) => setTargetCidr(e.target.value)}
              placeholder="10.20.0.0/16"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="policy-protocol" className="block text-xs text-slate-400 mb-1">
              Protocol
            </label>
            <select
              id="policy-protocol"
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as PolicyProtocol)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value={PolicyProtocol.ANY}>ANY</option>
              <option value={PolicyProtocol.TCP}>TCP</option>
              <option value={PolicyProtocol.UDP}>UDP</option>
              <option value={PolicyProtocol.ICMP}>ICMP</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-port-range" className="block text-xs text-slate-400 mb-1">
              Port Range (TCP/UDP)
            </label>
            <input
              id="policy-port-range"
              type="text"
              value={portRange}
              onChange={(e) => setPortRange(e.target.value)}
              placeholder="443 or 8000-8080"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="policy-action" className="block text-xs text-slate-400 mb-1">
              Action
            </label>
            <select
              id="policy-action"
              value={action}
              onChange={(e) => setAction(e.target.value as PolicyAction)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value={PolicyAction.ALLOW}>ALLOW</option>
              <option value={PolicyAction.DENY}>DENY</option>
            </select>
          </div>

          <div>
            <label htmlFor="policy-priority" className="block text-xs text-slate-400 mb-1">
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
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Policy'}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
        >
          {activeError instanceof Error ? activeError.message : 'Policy request failed'}
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading policies...</p>
      ) : policies.length === 0 && !listQuery.error ? (
        <p className="text-sm text-slate-400">No policies configured.</p>
      ) : policies.length > 0 ? (
        <div className="space-y-2">
          {policies.map((pol) => (
            <div
              key={pol.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-100">{pol.name}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">
                    {pol.role}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                      pol.action === PolicyAction.ALLOW
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {pol.action}
                  </span>
                  <span className="text-xs text-slate-400">Priority {pol.priority}</span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  <span>{pol.targetCidr}</span>
                  <span> · {pol.protocol}</span>
                  {pol.portRange ? <span>:{pol.portRange}</span> : null}
                </div>
              </div>

              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => setPendingDeletePolicy(pol)}
                className="rounded border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-950/60 disabled:opacity-50"
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
          <p>
            Are you sure you want to delete policy{' '}
            <strong className="text-slate-100">{pendingDeletePolicy?.name}</strong> (
            {pendingDeletePolicy?.role} {pendingDeletePolicy?.action} {pendingDeletePolicy?.targetCidr}
            )? This rule will be immediately removed from the zero-trust firewall.
          </p>
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
