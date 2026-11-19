# MANGO VPN — Project Progress Tracker

> **Last Updated:** 2026-11-19  
> **Current Branch:** `main` (`9562c53`)  
> **Recent Merged PRs:** `#1` (`feature/frontend-ui`), `#2` (`feature/ui`), `#3` (`feature/rain-admin`)

Use this checklist to track implementation status, end-to-end verification, and remaining work across the monorepo.

---

## 1. Monorepo & Infrastructure

- [x] Monorepo workspaces configured (`Rain/*`, `Sobree/*`, `packages/*`) in `package.json`
- [x] Shared TypeScript DTOs & contracts (`packages/shared/src/contracts.ts`)
- [x] Environment readiness script (`scripts/check-environment.ps1` / `npm run check:env`)
- [x] Local Windows Agent simulator (`scripts/mock-agent.js` / `npm run mock:agent`)
- [x] Docker Compose stack (`docker-compose.yml`: `postgres`, `vpn-gateway`, `api`, `portal`)
- [ ] Verify full `docker compose up` stack end-to-end on target environment

---

## 2. Backend Control Plane (`Sobree/api/`)

### Database & Schema (`Sobree/api/prisma/schema.prisma`)
- [x] 8-table Zero-Trust Prisma schema (`Role`, `User`, `Device`, `VpnPeer`, `VpnSession`, `VpnPolicy`, `AuditLog`, `AgentVersion`)
- [x] Seed script (`Rain/admin/src/seed.ts` / `npm run db:seed`)
- [ ] Run `db:generate`, `db:migrate`, and `db:seed` against live PostgreSQL container

### Auth & MFA (`Sobree/api/src/modules/auth/`)
- [x] `POST /api/auth/login` (password verification + 6-digit OTP challenge generation)
- [x] `POST /api/auth/verify-otp` (OTP verification + JWT `accessToken` & `refreshToken` issuance)
- [x] Auth middleware (`Sobree/api/src/middleware/auth.middleware.ts`)
- [ ] Token refresh endpoint & real SMS/OTP provider integration (currently logs OTP to stdout for dev)

### VPN Negotiation & IPAM (`Sobree/api/src/modules/vpn/`)
- [x] `POST /api/vpn/connect` (IP allocation from `10.13.13.0/24`, peer registration, tunnel config response)
- [x] `POST /api/vpn/disconnect`
- [ ] Live integration test between `Sobree/api` and `Sobree/vpn-daemon`

---

## 3. Admin API (`Rain/admin/`)

Mounted in `Sobree/api/src/server.ts` via `@mango/rain-admin`:

- [x] `GET /api/devices` & `DELETE /api/devices/:id`
- [x] `GET /api/sessions`
- [x] `GET /api/audit-logs`
- [x] `GET /api/agent-versions`
- [x] `GET /api/users` & `POST /api/users`
- [x] `GET /api/policies`, `POST /api/policies`, & `DELETE /api/policies/:id`
- [ ] Session disconnect/force-terminate endpoint (if needed for live Admin session kick)
- [ ] Automated API integration tests

---

## 4. Web Portal UI (`Rain/portal/`)

- [x] Mobile-style Login & 6-digit OTP Verification (`LoginForm.tsx`, `OtpModal.tsx`)
- [x] Role-Based Access Control (RBAC) Sidebar & navigation (`Sidebar.tsx`: `ADMIN`, `STAFF`, `CLIENT`)
- [x] VPN Connection Dashboard (`VpnDashboard.tsx`: agent health check, connect/disconnect, assigned IP, accessible networks)
- [x] Admin Panel (`AdminPanel.tsx`):
  - [x] Users management & create user modal
  - [x] Devices table, revocation, & posture inspector
  - [x] Zero-Trust Policies table, create modal, & delete
  - [x] Active/Historical Sessions table
  - [x] Audit Logs table & detail inspector
  - [x] Agent Versions / Releases manager
  - [x] Quick Stats summary cards & real-time search filter
- [x] Toast notifications (`Toast.tsx`) & Header (`Header.tsx`)
- [ ] End-to-end browser verification against live API + live Windows Agent (beyond `mock-agent.js`)

---

## 5. Systems & Native Daemons (`Sobree/agent-windows/` & `Sobree/vpn-daemon/`)

### Windows Agent (`Sobree/agent-windows/main.go`)
- [x] Windows Service wrapper (`golang.org/x/sys/windows/svc`) + `-debug` console mode
- [x] Loopback HTTP listener (`127.0.0.1:47821`) with Chromium Private Network Access (PNA) headers
- [x] Curve25519 WireGuard keypair generation
- [ ] Verify real WireGuard tunnel activation on Windows (`wireguard.exe` / WinTun adapter)

### Linux VPN Daemon (`Sobree/vpn-daemon/main.go`)
- [x] Unix Domain Socket (`/var/run/mango-vpn.sock`) / HTTP handler for peer registration & removal
- [x] Dynamic `wg set` & `nftables` (`inet mango_vpn` forward chain) rule management
- [ ] Verify inside Linux `vpn-gateway` container with `NET_ADMIN` capability

---

## 6. Quick Verification Commands

```powershell
# 1. Check local tools
npm run check:env

# 2. Build all workspaces
npm run build

# 3. Lint all workspaces
npm run lint

# 4. Run in mock mode (UI + API + Mock Agent)
npm run mock:agent
npm run dev:api
npm run dev:portal
```
