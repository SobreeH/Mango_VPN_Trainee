import type { AuthUserDto, DaemonRemovePeerRequest } from '@mango/shared';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUserDto;
  }
}

export interface AdminVpnDaemonClient {
  removePeer(req: DaemonRemovePeerRequest): Promise<void>;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertVpnDaemon(vpnDaemon?: AdminVpnDaemonClient): AdminVpnDaemonClient {
  if (!vpnDaemon) {
    throw new Error('VPN daemon client is not configured');
  }
  return vpnDaemon;
}

/**
 * Calls `vpnDaemon.removePeer` for each distinct non-empty publicKey.
 * Fails fast on daemon errors so DB state is not falsely marked revoked/disconnected.
 */
export async function teardownPeersOnDaemon(
  vpnDaemon: AdminVpnDaemonClient | undefined,
  publicKeys: string[],
): Promise<string[]> {
  const uniqueKeys = [...new Set(publicKeys.map((k) => k.trim()).filter((k) => k.length > 0))];
  if (uniqueKeys.length === 0) {
    return [];
  }
  const client = assertVpnDaemon(vpnDaemon);
  for (const publicKey of uniqueKeys) {
    await client.removePeer({ publicKey });
  }
  return uniqueKeys;
}
