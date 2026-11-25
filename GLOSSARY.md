# MANGO VPN

Zero-Trust Role-Based Multi-Provider VPN Control Plane, Endpoint Agent, and Gateway Enforcement System.

## Language

**VPN Gateway (`VpnGateway`)**:
A registered VPN termination endpoint managed by MANGO VPN, typed by provider (`WIREGUARD`, `FORTINET`, `CISCO`) with its own IPAM mode and CIDR subnet.
_Avoid_: Tunnel server, VPN node, appliance profile

**Provider Driver (`ProviderDriver`)**:
An enforcement adapter in `Sobree/vpn-daemon` that translates peer lifecycle and Zero-Trust role policies into vendor-specific primitives (`wg`/`nftables`, FortiOS REST API, Cisco ASA/FTD REST API).
_Avoid_: VPN plugin, backend adapter

**Tunnel Runner (`TunnelRunner`)**:
A client-side driver in `Sobree/agent-windows` that activates and tears down the OS tunnel for a specific `VpnProviderType` (`wireguard.exe`/`wg-quick`, `openconnect --protocol=fortinet`, `openconnect --protocol=anyconnect`).
_Avoid_: Client launcher, VPN wrapper

**Peer Identity (`peerIdentity`)**:
The provider-specific identifier for an active client tunnel (a 32-byte base64 Curve25519 public key for WireGuard, or an ephemeral session/username handle for Fortinet and Cisco).
_Avoid_: Client ID, peer key (for non-WireGuard)

**Connect Ticket (`ConnectTicket`)**:
A single-use, 60-second token issued after MFA verification that binds a user and target `VpnGateway` for local Agent redemption.
_Avoid_: Session token, VPN OTP
