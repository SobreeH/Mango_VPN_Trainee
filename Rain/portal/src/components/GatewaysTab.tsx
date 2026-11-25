import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  GatewayIpamMode,
  RoleName,
  VpnProviderType,
  type VpnGatewayDto,
} from '@mango/shared';
import type { AuthRefreshContext } from '../api/auth';
import {
  createGateway,
  deleteGateway,
  fetchGateways,
  updateGateway,
} from '../lib/adminApi';
import { ConfirmModal } from './ConfirmModal';

interface GatewaysTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
}

const PROVIDER_BADGE_STYLES: Record<VpnProviderType, string> = {
  [VpnProviderType.WIREGUARD]: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  [VpnProviderType.FORTINET]: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  [VpnProviderType.CISCO]: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
};

const DEFAULT_SUBNET_BY_PROVIDER: Record<VpnProviderType, string> = {
  [VpnProviderType.WIREGUARD]: '10.13.13.0/24',
  [VpnProviderType.FORTINET]: '10.40.0.0/24',
  [VpnProviderType.CISCO]: '10.50.0.0/24',
};

export function GatewaysTab({ apiBaseUrl, accessToken, auth }: GatewaysTabProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState<VpnProviderType>(VpnProviderType.WIREGUARD);
  const [endpoint, setEndpoint] = useState('');
  const [subnetCidr, setSubnetCidr] = useState('10.13.13.0/24');
  const [ipamMode, setIpamMode] = useState<GatewayIpamMode>(GatewayIpamMode.API_MANAGED);
  const [allowedRoles, setAllowedRoles] = useState<RoleName[]>([
    RoleName.ADMIN,
    RoleName.STAFF,
    RoleName.CLIENT,
  ]);
  const [isDefault, setIsDefault] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VpnGatewayDto | null>(null);

  const listQuery = useQuery({
    queryKey: ['gateways', apiBaseUrl],
    queryFn: () => fetchGateways(apiBaseUrl, accessToken, auth),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createGateway(
        apiBaseUrl,
        accessToken,
        {
          name,
          providerType,
          endpoint,
          subnetCidr,
          ipamMode,
          allowedRoles,
          isDefault,
          isEnabled: true,
        },
        auth,
      ),
    onSuccess: () => {
      setName('');
      setEndpoint('');
      setIsDefault(false);
      void queryClient.invalidateQueries({ queryKey: ['gateways', apiBaseUrl] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (gw: VpnGatewayDto) =>
      updateGateway(apiBaseUrl, accessToken, gw.id, { isEnabled: !gw.isEnabled }, auth),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gateways', apiBaseUrl] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGateway(apiBaseUrl, accessToken, id, auth),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['gateways', apiBaseUrl] });
    },
  });

  const handleProviderChange = (next: VpnProviderType) => {
    setProviderType(next);
    setSubnetCidr(DEFAULT_SUBNET_BY_PROVIDER[next]);
  };

  const toggleRole = (role: RoleName) => {
    setAllowedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.length > 1 ? prev.filter((r) => r !== role) : prev;
      }
      return [...prev, role];
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const gateways: VpnGatewayDto[] = listQuery.data?.items ?? [];
  const activeError =
    listQuery.error ?? createMutation.error ?? toggleMutation.error ?? deleteMutation.error ?? null;

  return (
    <section aria-label="Gateways" className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-100">Register VPN Gateway</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="gateway-name" className="block text-xs text-slate-400 mb-1">
              Gateway Name
            </label>
            <input
              id="gateway-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HQ FortiGate SSL-VPN"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="gateway-provider" className="block text-xs text-slate-400 mb-1">
              VPN Provider
            </label>
            <select
              id="gateway-provider"
              value={providerType}
              onChange={(e) => handleProviderChange(e.target.value as VpnProviderType)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value={VpnProviderType.WIREGUARD}>WIREGUARD</option>
              <option value={VpnProviderType.FORTINET}>FORTINET</option>
              <option value={VpnProviderType.CISCO}>CISCO</option>
            </select>
          </div>

          <div>
            <label htmlFor="gateway-endpoint" className="block text-xs text-slate-400 mb-1">
              Endpoint (host:port)
            </label>
            <input
              id="gateway-endpoint"
              type="text"
              required
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={
                providerType === VpnProviderType.WIREGUARD
                  ? 'vpn.mango.internal:51820'
                  : providerType === VpnProviderType.FORTINET
                    ? 'fg.mango.internal:443'
                    : 'asa.mango.internal:443'
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="gateway-subnet" className="block text-xs text-slate-400 mb-1">
              Subnet CIDR
            </label>
            <input
              id="gateway-subnet"
              type="text"
              required
              value={subnetCidr}
              onChange={(e) => setSubnetCidr(e.target.value)}
              placeholder="10.40.0.0/24"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div>
            <label htmlFor="gateway-ipam" className="block text-xs text-slate-400 mb-1">
              IPAM Mode
            </label>
            <select
              id="gateway-ipam"
              value={ipamMode}
              onChange={(e) => setIpamMode(e.target.value as GatewayIpamMode)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value={GatewayIpamMode.API_MANAGED}>API_MANAGED</option>
              <option value={GatewayIpamMode.GATEWAY_ASSIGNED}>GATEWAY_ASSIGNED</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <span className="block text-xs text-slate-400">Allowed Roles</span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
              {[RoleName.ADMIN, RoleName.STAFF, RoleName.CLIENT].map((role) => (
                <label key={role} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="rounded border-slate-600"
                  />
                  <span>{role}</span>
                </label>
              ))}
              <label className="inline-flex items-center gap-1.5 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-600"
                />
                <span>Default</span>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Registering...' : 'Register Gateway'}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200"
        >
          {activeError instanceof Error ? activeError.message : 'Gateway request failed'}
        </div>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading VPN gateways...</p>
      ) : gateways.length === 0 && !listQuery.error ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-6 text-center text-sm text-slate-400">
          No VPN gateways registered.
        </div>
      ) : gateways.length > 0 ? (
        <div className="space-y-2">
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-100">{gw.name}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${PROVIDER_BADGE_STYLES[gw.providerType]}`}
                  >
                    {gw.providerType}
                  </span>
                  {gw.isDefault && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">
                      DEFAULT
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      gw.isEnabled
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-700/40 text-slate-400'
                    }`}
                  >
                    {gw.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  <span>{gw.endpoint}</span>
                  <span> · {gw.subnetCidr}</span>
                  <span> · {gw.ipamMode}</span>
                  <span> · Roles: {gw.allowedRoles.join(', ')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate(gw)}
                  className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  {gw.isEnabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => setPendingDelete(gw)}
                  className="rounded border border-red-700/60 px-2.5 py-1 text-xs text-red-200 hover:bg-red-950/60 disabled:opacity-40"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete VPN Gateway"
        message={
          <p>
            Are you sure you want to remove gateway{' '}
            <strong className="text-slate-100">{pendingDelete?.name}</strong> (
            {pendingDelete?.providerType})?
          </p>
        }
        confirmLabel="Delete Gateway"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
          }
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
