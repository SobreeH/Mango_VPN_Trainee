import { VpnProviderType, type AuthUserDto, type DaemonRemovePeerRequest } from '@mango/shared';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUserDto;
  }
}

export interface AdminVpnDaemonClient {
  removePeer(req: DaemonRemovePeerRequest): Promise<void>;
}

export interface TeardownPeerTarget {
  publicKey: string;
  peerIdentity?: string | null;
  providerType?: VpnProviderType | string | null;
  gatewayId?: string | null;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertVpnDaemon(vpnDaemon?: AdminVpnDaemonClient): AdminVpnDaemonClient {
  if (!vpnDaemon) {
    throw new Error('VPN daemon client is not configured');
  }
  return vpnDaemon;
}

/**
 * Calls `vpnDaemon.removePeer` for each distinct peer across WireGuard, Fortinet, and Cisco.
 * Preserves the exact `{ publicKey }` payload shape for default WireGuard peers, and fails fast
 * on daemon errors so DB state is not falsely marked revoked/disconnected.
 */
export async function teardownPeersOnDaemon(
  vpnDaemon: AdminVpnDaemonClient | undefined,
  peers: Array<string | TeardownPeerTarget>,
): Promise<string[]> {
  const normalized: TeardownPeerTarget[] = [];
  const seen = new Set<string>();

  for (const item of peers) {
    const target: TeardownPeerTarget =
      typeof item === 'string'
        ? { publicKey: item }
        : item;
    const key = (target.peerIdentity?.trim() || target.publicKey.trim());
    if (!key) continue;
    const provider = target.providerType ? String(target.providerType).trim().toUpperCase() : VpnProviderType.WIREGUARD;
    const dedupeKey = `${provider}:${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    normalized.push({
      publicKey: target.publicKey.trim() || key,
      peerIdentity: target.peerIdentity?.trim() || undefined,
      providerType: provider,
      gatewayId: target.gatewayId?.trim() || undefined,
    });
  }

  if (normalized.length === 0) {
    return [];
  }

  const client = assertVpnDaemon(vpnDaemon);
  const removedIds: string[] = [];
  for (const target of normalized) {
    if (
      (!target.providerType || target.providerType === VpnProviderType.WIREGUARD) &&
      !target.gatewayId
    ) {
      await client.removePeer({ publicKey: target.publicKey });
    } else {
      await client.removePeer({
        publicKey: target.publicKey,
        peerIdentity: target.peerIdentity ?? target.publicKey,
        providerType: target.providerType as VpnProviderType,
        ...(target.gatewayId ? { gatewayId: target.gatewayId } : {}),
      });
    }
    removedIds.push(target.peerIdentity ?? target.publicKey);
  }
  return removedIds;
}
