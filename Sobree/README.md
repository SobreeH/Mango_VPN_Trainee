# ⚡ Sobree's Development Guide

[English](README.md) | [ภาษาไทย](README.th.md)

Welcome, **Sobree**! This guide details how to build, test, and maintain the systems, networking, and security core of MANGO VPN.

---

## 1. Your Scope & Ownership

You own the **systems engineering, kernel networking, and control plane core**:

1. **`Sobree/api/`**: The Management API control plane.
   - **Prisma Schema (`prisma/schema.prisma`)**: 8 core relational tables with foreign keys and UUIDs.
   - **Auth Module (`src/modules/auth`)**: Step 1-4 authentication, 6-digit OTP challenge generation, bcrypt hashing, JWT issuance.
   - **VPN Module (`src/modules/vpn`)**: IPAM allocation (`10.13.13.0/24`), peer public key registration, lease management.
   - **Server Entrypoint (`src/server.ts`)**: Fastify configuration, CORS, auto-mounting `@mango/rain-admin`.
2. **`Sobree/agent-windows/`**: Production Go Windows Service.
   - Runs under `LocalSystem` security context via `golang.org/x/sys/windows/svc`.
   - Local loopback HTTP listener (`127.0.0.1:47821`) with **Chromium Private Network Access (PNA)**.
   - Curve25519 keypair generation in memory (clamped per WireGuard spec).
   - WireGuard adapter configuration & handshake execution.
3. **`Sobree/vpn-daemon/`**: Linux WireGuard & Policy Enforcement Daemon.
   - Communicates over Unix Domain Socket (`/var/run/mango-vpn.sock`) or TCP fallback.
   - Dynamic peer registration via `wg set wg0 peer <pubkey> allowed-ips <ip>/32`.
   - Stateful role-based firewall rule injection into `nftables` `inet mango_vpn` forward chain.
4. **`packages/shared/`**: Day-1 TypeScript API contracts and security DTOs.

---

## 2. Prerequisites for Sobree

As the Systems & Security developer, you require the full systems toolchain:

| Tool | Recommended Version | Purpose |
| --- | --- | --- |
| **Node.js** | `>= 20.0.0 LTS` | Management API & monorepo scripts |
| **npm** | `>= 10.0.0` | Monorepo workspaces management |
| **Docker & Compose** | `>= 24.0.0` (Compose v2) | PostgreSQL 16 & Linux WireGuard gateway |
| **Go** | `>= 1.22` | Windows Service & Linux VPN Daemon |
| **Git** | `>= 2.30.0` | Version control |

---

## 3. Daily Development Routine

### Step 1: Start PostgreSQL and WireGuard Gateway Containers
From the monorepo root:
```powershell
docker compose up -d postgres vpn-gateway
```
Verify containers are healthy:
```powershell
docker compose ps
```

---

### Step 2: Database Schema & Client Generation
When updating `Sobree/api/prisma/schema.prisma`:
```powershell
# Generate Prisma Client
npm run db:generate

# Apply migrations to local PostgreSQL
npm run db:migrate

# Populate demo data using Rain's seed script
npm run db:seed
```

---

### Step 3: Run the Management API
```powershell
npm run dev:api
```
- Listens on `http://localhost:4000`.
- Automatically mounts Rain's admin endpoints (`@mango/rain-admin`).
- Prints authentication OTP challenges directly to stdout for rapid testing.

---

### Step 4: Run the Go Windows Agent
You can run the Windows agent in interactive console mode without registering it with the Windows Service Control Manager (SCM):

```powershell
cd Sobree/agent-windows
go run main.go -debug
```
- Listens on `http://127.0.0.1:47821`.
- Provides `/health`, `/status`, `/connect`, and `/disconnect`.
- Implements `Access-Control-Allow-Private-Network: true` on `OPTIONS` preflight requests.

To build the standalone `.exe` binary:
```powershell
go build -o bin/mango-agent-windows.exe .
```

To install as an official Windows Service (run PowerShell as Administrator):
```powershell
sc.exe create MangoVpnAgent binPath= "E:\Trainee\Mango_VPN_Trainee\Sobree\agent-windows\bin\mango-agent-windows.exe" start= auto
sc.exe start MangoVpnAgent
```

---

### Step 5: Run the Linux VPN Policy Daemon
The daemon controls `wg0` and `nftables`:

```bash
cd Sobree/vpn-daemon
go run main.go
```
- In development/Windows environments, it gracefully falls back to TCP port `50051`.
- In production Linux gateways (e.g. Ubuntu 24.04), it binds to `/var/run/mango-vpn.sock` and directly interfaces with `/usr/bin/wg` and `/usr/sbin/nft`.

---

## 4. Zero-Trust Security Architecture

### A. Client-Side Key Generation (Curve25519)
The user and portal **never** handle `.conf` files or private keys. The Windows Agent generates keys in memory:
```go
// 32-byte scalar multiplication
curve25519.ScalarBaseMult(&pub, &priv)
```
- The private key is retained exclusively in `LocalSystem` memory.
- Only the Base64 public key is sent to the server in `POST /api/vpn/connect`.

### B. Dynamic `nftables` Forward Chain Isolation
The default policy on the forward chain is strict **DROP**:
```nftables
table inet mango_vpn {
    chain forward {
        type filter hook forward priority 0; policy drop;
        ct state established,related accept
    }
}
```
When a peer authenticates, the daemon injects granular allow rules matching their role:
- **`CLIENT`**: Isolated to single `/32` target hosts on port 80/443.
- **`STAFF`**: Granted access to internal RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`).
- **`ADMIN`**: Granted full `0.0.0.0/0` forwarding.

---

## 5. Collaboration Contract with Rain

1. **Rain's Admin Module**:
   - Rain maintains `Rain/admin/src/admin.service.ts` and `admin.routes.ts`.
   - Your API imports it via package dependency `@mango/rain-admin` in `Sobree/api/src/server.ts`.
   - **No merge conflicts occur** because Rain never touches `Sobree/api`!
2. **Contracts**:
   - If an API payload needs to change, update [`packages/shared/src/contracts.ts`](file:///e:/Trainee/Mango_VPN_Trainee/packages/shared/src/contracts.ts), run `npm --workspace=@mango/shared run build`, and notify Rain.
3. **Mock Agent**:
   - If you modify the agent loopback protocol, update [`scripts/mock-agent.js`](file:///e:/Trainee/Mango_VPN_Trainee/scripts/mock-agent.js) so Rain's portal simulator stays in sync.

---

## 6. Monorepo Verification

Verify everything builds across the entire monorepo before committing:
```powershell
npm run build
```
This builds `@mango/shared`, `@mango/rain-admin`, `@mango/api`, and `@mango/portal`.

