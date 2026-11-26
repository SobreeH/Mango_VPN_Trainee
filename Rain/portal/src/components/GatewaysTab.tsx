import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
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
import { getThemeClasses, type UiLang } from '../lib/theme';
import { ConfirmModal } from './ConfirmModal';

interface GatewaysTabProps {
  apiBaseUrl: string;
  accessToken: string;
  auth?: AuthRefreshContext;
  lang?: UiLang;
  isDark?: boolean;
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

export function GatewaysTab({ apiBaseUrl, accessToken, auth, lang = 'th', isDark = true }: GatewaysTabProps) {
  const t = getThemeClasses(isDark);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState<'ALL' | VpnProviderType>('ALL');
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
  const filteredGateways = gateways.filter((gw) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch =
      term === '' ||
      gw.name.toLowerCase().includes(term) ||
      gw.endpoint.toLowerCase().includes(term) ||
      gw.subnetCidr.toLowerCase().includes(term) ||
      gw.providerType.toLowerCase().includes(term);
    const matchesProvider = providerFilter === 'ALL' || gw.providerType === providerFilter;
    return matchesSearch && matchesProvider;
  });
  const activeError =
    listQuery.error ?? createMutation.error ?? toggleMutation.error ?? deleteMutation.error ?? null;

  return (
    <section aria-label="Gateways" className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className={`rounded-3xl border p-6 space-y-4 ${t.card}`}
      >
        <h3 className={`text-sm font-bold ${t.heading}`}>
          {lang === 'th' ? 'ลงทะเบียน VPN Gateway ใหม่' : 'Register VPN Gateway'}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="gateway-name" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'ชื่อเกตเวย์ (Gateway Name)' : 'Gateway Name'}
            </label>
            <input
              id="gateway-name"
              aria-label="Gateway Name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="HQ FortiGate SSL-VPN"
              className={`w-full h-11 rounded-xl border px-4 text-sm focus:outline-none transition-colors ${t.input}`}
            />
          </div>

          <div>
            <label htmlFor="gateway-provider" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'ผู้ให้บริการ (VPN Provider)' : 'VPN Provider'}
            </label>
            <select
              id="gateway-provider"
              aria-label="VPN Provider"
              value={providerType}
              onChange={(e) => handleProviderChange(e.target.value as VpnProviderType)}
              className={`w-full h-11 rounded-xl border px-4 text-sm focus:outline-none transition-colors cursor-pointer ${t.input}`}
            >
              <option value={VpnProviderType.WIREGUARD}>WIREGUARD</option>
              <option value={VpnProviderType.FORTINET}>FORTINET</option>
              <option value={VpnProviderType.CISCO}>CISCO</option>
            </select>
          </div>

          <div>
            <label htmlFor="gateway-endpoint" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'จุดเชื่อมต่อ (Endpoint host:port)' : 'Endpoint (host:port)'}
            </label>
            <input
              id="gateway-endpoint"
              aria-label="Endpoint (host:port)"
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
              className={`w-full h-11 rounded-xl border px-4 text-sm focus:outline-none transition-colors font-mono ${t.input}`}
            />
          </div>

          <div>
            <label htmlFor="gateway-subnet" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              Subnet CIDR
            </label>
            <input
              id="gateway-subnet"
              aria-label="Subnet CIDR"
              type="text"
              required
              value={subnetCidr}
              onChange={(e) => setSubnetCidr(e.target.value)}
              placeholder="10.40.0.0/24"
              className={`w-full h-11 rounded-xl border px-4 text-sm focus:outline-none transition-colors font-mono ${t.input}`}
            />
          </div>

          <div>
            <label htmlFor="gateway-ipam" className={`block text-xs font-medium mb-1 ${t.muted}`}>
              {lang === 'th' ? 'โหมดจัดสรร IP (IPAM Mode)' : 'IPAM Mode'}
            </label>
            <select
              id="gateway-ipam"
              aria-label="IPAM Mode"
              value={ipamMode}
              onChange={(e) => setIpamMode(e.target.value as GatewayIpamMode)}
              className={`w-full h-11 rounded-xl border px-4 text-sm focus:outline-none transition-colors cursor-pointer ${t.input}`}
            >
              <option value={GatewayIpamMode.API_MANAGED}>API_MANAGED</option>
              <option value={GatewayIpamMode.GATEWAY_ASSIGNED}>GATEWAY_ASSIGNED</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-2">
            <span className={`block text-xs font-medium ${t.muted}`}>
              {lang === 'th' ? 'บทบาทที่อนุญาต (Allowed Roles)' : 'Allowed Roles'}
            </span>
            <div className={`flex flex-wrap items-center gap-3 text-xs ${t.text}`}>
              {[RoleName.ADMIN, RoleName.STAFF, RoleName.CLIENT].map((role) => (
                <label key={role} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="rounded border-stone-500"
                  />
                  <span>{role}</span>
                </label>
              ))}
              <label className="inline-flex items-center gap-1.5 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-stone-500"
                />
                <span>{lang === 'th' ? 'ค่าเริ่มต้น (Default)' : 'Default'}</span>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          aria-label="Register Gateway"
          disabled={createMutation.isPending}
          className="rounded-xl bg-[#059669] hover:bg-[#047857] px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-colors"
        >
          {createMutation.isPending
            ? (lang === 'th' ? 'กำลังลงทะเบียน...' : 'Registering...')
            : (lang === 'th' ? 'ลงทะเบียนเกตเวย์' : 'Register Gateway')}
        </button>
      </form>

      {activeError && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-400"
        >
          {activeError instanceof Error ? activeError.message : 'Gateway request failed'}
        </div>
      )}

      {/* Search & Provider Filter Bar */}
      {gateways.length > 0 && (
        <div className={`flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between rounded-2xl border p-4 ${t.card}`}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
            <input
              type="text"
              aria-label="Search gateways"
              placeholder={lang === 'th' ? 'ค้นหาชื่อเกตเวย์ Endpoint หรือ Subnet...' : 'Search gateway name, endpoint, or subnet...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full sm:max-w-sm h-10 rounded-xl border pl-9 pr-9 text-xs focus:outline-none transition-colors ${t.input}`}
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full ${t.muted}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter provider"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as 'ALL' | VpnProviderType)}
              className={`h-10 rounded-xl border px-3 text-xs focus:outline-none cursor-pointer ${t.input}`}
            >
              <option value="ALL">{lang === 'th' ? 'ทุกผู้ให้บริการ' : 'All Providers'}</option>
              <option value={VpnProviderType.WIREGUARD}>WIREGUARD</option>
              <option value={VpnProviderType.FORTINET}>FORTINET</option>
              <option value={VpnProviderType.CISCO}>CISCO</option>
            </select>
          </div>
        </div>
      )}

      {listQuery.isLoading ? (
        <p className={`text-sm ${t.muted}`}>{lang === 'th' ? 'กำลังโหลดข้อมูลเกตเวย์...' : 'Loading VPN gateways...'}</p>
      ) : gateways.length === 0 && !listQuery.error ? (
        <div className={`rounded-3xl border p-8 text-center text-sm ${t.card} ${t.muted}`}>
          {lang === 'th' ? 'ยังไม่มี VPN Gateway ที่ลงทะเบียนไว้' : 'No VPN gateways registered.'}
          {lang === 'th' && <span className="sr-only">No VPN gateways registered.</span>}
        </div>
      ) : filteredGateways.length === 0 ? (
        <div className={`rounded-3xl border p-8 text-center text-xs space-y-2 ${t.card} ${t.muted}`}>
          <p>{lang === 'th' ? 'ไม่พบเกตเวย์ที่ตรงกับการค้นหา' : 'No gateways match your search.'}</p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setProviderFilter('ALL');
            }}
            className="text-emerald-400 hover:underline font-semibold"
          >
            {lang === 'th' ? 'ล้างการค้นหา' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGateways.map((gw) => (
            <div
              key={gw.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-3xl border p-5 text-sm ${t.card}`}
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-semibold ${t.heading}`}>{gw.name}</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${PROVIDER_BADGE_STYLES[gw.providerType]}`}
                  >
                    {gw.providerType}
                  </span>
                  {gw.isDefault && (
                    <span className="rounded-full bg-amber-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                      DEFAULT
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                      gw.isEnabled
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                        : t.pillMuted
                    }`}
                  >
                    {gw.isEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <div className={`text-xs font-mono ${t.muted}`}>
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
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium disabled:opacity-40 transition-colors ${t.secondaryBtn}`}
                >
                  {gw.isEnabled
                    ? (lang === 'th' ? 'ปิดใช้งาน' : 'Disable')
                    : (lang === 'th' ? 'เปิดใช้งาน' : 'Enable')}
                </button>
                <button
                  type="button"
                  aria-label="Delete"
                  disabled={deleteMutation.isPending}
                  onClick={() => setPendingDelete(gw)}
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/20 disabled:opacity-40 transition-colors"
                >
                  {lang === 'th' ? 'ลบ' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        isDark={isDark}
        title={lang === 'th' ? 'ลบ VPN Gateway' : 'Delete VPN Gateway'}
        message={
          <p>
            {lang === 'th' ? 'คุณต้องการลบเกตเวย์ ' : 'Are you sure you want to remove gateway '}
            <strong className={t.heading}>{pendingDelete?.name}</strong> (
            {pendingDelete?.providerType})?
          </p>
        }
        confirmLabel="Delete Gateway"
        cancelLabel={lang === 'th' ? 'ยกเลิก' : 'Cancel'}
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
