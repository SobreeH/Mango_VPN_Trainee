import type {
  DaemonAddPeerRequest,
  DaemonRemovePeerRequest,
  DaemonSyncPoliciesRequest,
} from '@mango/shared';
import type { ApiConfig } from '../config.js';

export interface VpnDaemonClient {
  addPeer(req: DaemonAddPeerRequest): Promise<void>;
  removePeer(req: DaemonRemovePeerRequest): Promise<void>;
  syncPolicies(req: DaemonSyncPoliciesRequest): Promise<void>;
}

export class HttpVpnDaemonClient implements VpnDaemonClient {
  private readonly baseUrl: string;
  private readonly sharedSecret: string;

  constructor(config: Pick<ApiConfig, 'vpnDaemonUrl' | 'daemonSharedSecret'>) {
    this.baseUrl = config.vpnDaemonUrl.replace(/\/+$/, '');
    this.sharedSecret = config.daemonSharedSecret;
  }

  async addPeer(req: DaemonAddPeerRequest): Promise<void> {
    await this.post('/peers', req);
  }

  async removePeer(req: DaemonRemovePeerRequest): Promise<void> {
    await this.post('/peers/remove', req);
  }

  async syncPolicies(req: DaemonSyncPoliciesRequest): Promise<void> {
    await this.post('/policies/sync', req);
  }

  private async post(path: string, body: unknown): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.sharedSecret}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = `VPN daemon returned HTTP ${res.status}`;
      try {
        const parsed = (await res.json()) as { error?: { message?: string }; message?: string };
        detail = parsed.error?.message ?? parsed.message ?? detail;
      } catch {
        // ignore non-JSON body
      }
      throw new Error(detail);
    }
  }
}
