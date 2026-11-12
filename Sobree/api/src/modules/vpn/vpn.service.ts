import { prisma } from '../../lib/prisma.js';
import {
  VpnConnectRequest,
  VpnConnectResponse,
  VpnDisconnectRequest,
  VpnDisconnectResponse,
} from '@mango/shared';

const WG_SERVER_PUBLIC_KEY = process.env.WG_SERVER_PUBLIC_KEY || 'bmFub01hbmdvV2lyZUd1YXJkU2VydmVyUHVibGljS2V5PQ==';
const WG_SERVER_ENDPOINT = process.env.WG_SERVER_ENDPOINT || '127.0.0.1:51820';
const WG_SERVER_ALLOWED_IPS = (process.env.WG_SERVER_ALLOWED_IPS || '10.13.13.0/24,10.0.0.0/8').split(',');

export class VpnService {
  /**
   * IPAM Helper: Allocate next available IP in 10.13.13.0/24 subnet (range .10 to .250)
   */
  private async allocateNextIp(): Promise<string> {
    const existingPeers = await prisma.vpnPeer.findMany({
      select: { assignedIp: true },
    });

    const usedIps = new Set(existingPeers.map(p => p.assignedIp.split('/')[0]));

    for (let i = 10; i <= 250; i++) {
      const candidateIp = `10.13.13.${i}`;
      if (!usedIps.has(candidateIp)) {
        return `${candidateIp}/32`;
      }
    }

    throw new Error('IPAM address pool exhausted for subnet 10.13.13.0/24');
  }

  /**
   * Step 5: Connect Peer, assign IP, generate WireGuard session
   */
  async connect(userId: string, body: VpnConnectRequest, clientIp: string): Promise<VpnConnectResponse> {
    if (!body.publicKey) {
      throw new Error('Client Curve25519 public key is required');
    }

    // 1. Upsert Device record if device metadata is provided
    let deviceId: string | undefined = body.deviceId;
    if (body.deviceName) {
      const device = await prisma.device.create({
        data: {
          userId,
          deviceName: body.deviceName || 'Windows-Endpoint',
          osInfo: body.osInfo || 'Windows NT 10.0',
          macAddress: body.macAddress || null,
          lastSeen: new Date(),
        },
      });
      deviceId = device.id;
    }

    // 2. Find existing peer for this public key or assign new IP
    let peer = await prisma.vpnPeer.findUnique({
      where: { publicKey: body.publicKey },
    });

    if (!peer) {
      const assignedIp = await this.allocateNextIp();
      peer = await prisma.vpnPeer.create({
        data: {
          userId,
          deviceId: deviceId || null,
          publicKey: body.publicKey,
          assignedIp,
          isEnabled: true,
        },
      });
    } else {
      // Re-enable and link to current user/device
      peer = await prisma.vpnPeer.update({
        where: { id: peer.id },
        data: {
          userId,
          deviceId: deviceId || peer.deviceId,
          isEnabled: true,
          updatedAt: new Date(),
        },
      });
    }

    // 3. Create active VPN Session
    const session = await prisma.vpnSession.create({
      data: {
        peerId: peer.id,
        connectedAt: new Date(),
        clientPublicIp: clientIp,
        bytesRx: BigInt(0),
        bytesTx: BigInt(0),
      },
    });

    // 4. Fetch User Role & Policies to determine allowed IP routing
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            policies: true,
          },
        },
      },
    });

    const rolePolicies = user?.role.policies || [];
    const allowedIps = rolePolicies.length > 0
      ? rolePolicies.map(p => p.destinationCidr)
      : WG_SERVER_ALLOWED_IPS;

    // 5. Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'VPN_TUNNEL_CONNECTED',
        ipAddress: clientIp,
        metadataJson: {
          peerId: peer.id,
          assignedIp: peer.assignedIp,
          role: user?.role.name,
          allowedIps,
        },
      },
    });

    const leaseExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      peerId: peer.id,
      assignedIp: peer.assignedIp,
      serverPublicKey: WG_SERVER_PUBLIC_KEY,
      endpoint: WG_SERVER_ENDPOINT,
      allowedIps,
      dnsServers: ['10.13.13.1', '1.1.1.1'],
      keepaliveSeconds: 25,
      sessionId: session.id,
      leaseExpiresAt,
    };
  }

  /**
   * Terminate VPN Session
   */
  async disconnect(userId: string, body: VpnDisconnectRequest, clientIp: string): Promise<VpnDisconnectResponse> {
    const session = await prisma.vpnSession.findUnique({
      where: { id: body.sessionId },
      include: { peer: true },
    });

    if (session && session.peer.userId === userId) {
      await prisma.vpnSession.update({
        where: { id: session.id },
        data: {
          disconnectedAt: new Date(),
          bytesRx: BigInt(body.bytesRx || 0),
          bytesTx: BigInt(body.bytesTx || 0),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'VPN_TUNNEL_DISCONNECTED',
          ipAddress: clientIp,
          metadataJson: {
            sessionId: session.id,
            bytesRx: body.bytesRx,
            bytesTx: body.bytesTx,
          },
        },
      });
    }

    return {
      success: true,
      message: 'VPN session terminated',
      disconnectedAt: new Date().toISOString(),
    };
  }
}
