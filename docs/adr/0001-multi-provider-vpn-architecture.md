# 0001: Multi-Provider VPN Gateway & Agent Architecture

Status: accepted

MANGO VPN originally supported only WireGuard (`wg` + `nftables` on the gateway and `wireguard.exe` / `wg-quick` on the endpoint agent), which prevented onboarding environments backed by Fortinet FortiGate SSL-VPN or Cisco AnyConnect / Secure Client appliances. We decided to retain `Sobree/api` and `Rain/admin` as the unified Zero-Trust control plane (password + TOTP MFA, Connect Tickets, RBAC policies, and audit logs), introduce a `VpnGateway` registry in PostgreSQL, generalize `Sobree/vpn-daemon` into a multi-provider enforcement service (`ProviderDriver` map), and refactor `Sobree/agent-windows` to dispatch tunnels across a pluggable `TunnelRunner` registry (`wireguard.exe`/`wg-quick` for WireGuard and `openconnect` with stdin ephemeral secrets for Fortinet and Cisco).

## Considered Options

- **Unified Control Plane + Enforcement Daemon (`Sobree/vpn-daemon`) + Endpoint `TunnelRunner` Map (chosen)**: Keeps appliance API credentials isolated in the enforcement plane, enforces a single Zero-Trust policy model across all vendors, and requires zero client `.conf` file downloads.
- **Direct Vendor REST Calls Inside `Sobree/api`**: Rejected because it couples the public-facing Node.js API directly to internal firewall appliance credentials and splits enforcement logic between Node.js and Go.
- **Client Tunnel Broker Only**: Rejected because MANGO VPN would lose centralized IPAM visibility, dynamic policy translation, and unified session revocation.

## Consequences

- `VpnPeer`, `VpnSession`, and `ConnectTicket` carry an optional `gatewayId` and `providerType` (defaulting to `WIREGUARD`) so legacy WireGuard flows and fixtures continue operating without modification.
- Both `scripts/mock-daemon.js` and `scripts/mock-agent.js` must mirror multi-provider validation and payload shapes per `AGENTS.md` Rules 5 and 6.
