# MANGO VPN v2 — Project Progress & Remaining Work Tracker

> **Last Verified**: 2026-11-20  
> **Active Branch**: `fix/sobree-dev-test-audit-readiness` (branched off `origin/main` after PR #17)  
> **Tracked Epic**: GitHub Issue `#5` (`MANGO VPN v2: Complete Zero-Trust WireGuard Rebuild`) — Tickets `#6`–`#13` closed; follow-up hardening/rollout tracked in `#19`, `#20`, `#21`

---

## 1. Project Status Overview

MANGO VPN v2 (`0.2.0`) is a **Zero-Trust Role-Based WireGuard Remote Access & Policy Management System**. All 8 implementation tickets (`#6`–`#13`) under Epic `#5` have been completed and merged into `main`, and the local dev/testing readiness audit (`fix/sobree-dev-test-audit-readiness`) resolved the remaining Docker, CI, environment-loading, and Portal UI blockers.

The full monorepo builds cleanly, passes all 70 Vitest tests on both `mangovpn_v2_test` and the local `mangovpn` database, passes all 17 Go unit tests across `Sobree/agent-windows` and `Sobree/vpn-daemon`, and runs end-to-end across all 4 healthy Docker Compose containers (`postgres`, `vpn-gateway`, `api`, `portal`).

### Automated Verification Snapshot (2026-11-20)

| Check | Command | Scope / Target | Result |
| :--- | :--- | :--- | :--- |
| Security & Anti-Mock Guardrails | `node scripts/check-guardrails.mjs` | `Rain/`, `Sobree/`, `packages/`, `docker-compose.yml` | ✅ **PASS** (`0` violations) |
| TypeScript Monorepo Build | `npm run build` | `@mango/shared`, `@mango/rain-admin`, `@mango/portal`, `@mango/api` | ✅ **PASS** (`4/4` workspaces) |
| Monorepo Test Suite (Test DB) | `npm test` | `DATABASE_URL=.../mangovpn_v2_test` | ✅ **PASS** (`70/70` tests: `3` admin, `27` portal, `40` api) |
| Monorepo Test Suite (Local DB) | `npm test` | `DATABASE_URL=.../mangovpn` | ✅ **PASS** (`70/70` tests: `3` admin, `27` portal, `40` api) |
| Windows Agent Go Checks | `cd Sobree/agent-windows && go vet ./... && go test -v ./... && go build ./...` | `github.com/mango-vpn/agent-windows` | ✅ **PASS** (`8/8` tests) |
| VPN Daemon Go Checks | `cd Sobree/vpn-daemon && go vet ./... && go test -v ./... && go build ./...` | `github.com/mango-vpn/vpn-daemon` | ✅ **PASS** (`9/9` tests) |
| Docker Compose Full Stack | `docker compose up -d --build && docker compose ps` | `mango-postgres`, `mango-vpn-gateway`, `mango-api`, `mango-portal` | ✅ **PASS** (`4/4` containers `healthy`; live HTTP + auth smoke verified) |

---

## 2. Completed Milestones (Epic #5 — Tickets #6 through #13)

| Issue | Title | Status | Key Files / Packages | Delivered Scope |
| :--- | :--- | :--- | :--- | :--- |
| **#5** | MANGO VPN v2: Complete Zero-Trust WireGuard Rebuild | ✅ Completed & Closed | Monorepo-wide | Full v2 Zero-Trust architecture replacing legacy v1 mocks, stubs, and hardcoded credentials |
| **#6** | 1. Clean-slate rebuild branch, workspace wipe, and runnable monorepo skeleton | ✅ Completed & Merged | `packages/shared/src/contracts.ts`, `Sobree/api/prisma/schema.prisma`, `scripts/check-guardrails.mjs` | Shared DTO contracts/enums (`@mango/shared`), 11-model PostgreSQL schema, and automated anti-mock/secret guardrail scanner |
| **#7** | 2. Password login, TOTP MFA enrollment/verification, and rotating JWT sessions | ✅ Completed & Merged | `Sobree/api/src/modules/auth/`, `Sobree/api/src/config.ts`, `Sobree/api/src/middleware/auth.ts` | Password login, AES-256-GCM encrypted TOTP enrollment/verification (`totp.ts`), HS256 JWT + rotating refresh tokens with reuse family revocation, DB-backed rate limiting, and fail-fast env validation |
| **#8** | 3. Windows Agent loopback security, one-time Connect Ticket, and mock-agent sync | ✅ Completed & Merged | `Sobree/api/src/modules/vpn/vpn.routes.ts`, `Sobree/agent-windows/main.go`, `scripts/mock-agent.js` | Single-use 60s Connect Ticket (`POST /api/vpn/ticket`), Windows Agent loopback HTTP API (`127.0.0.1:47821`) with strict `Origin` allowlist, PNA headers, `X-Mango-Agent-Token`, and synchronized `mock-agent.js` |
| **#9** | 4. End-to-end VPN Connect & Disconnect (Ticket redemption, IPAM, wg set, Portal state) | ✅ Completed & Merged | `Sobree/api/src/modules/vpn/vpn.routes.ts`, `Sobree/agent-windows/main.go`, `Rain/portal/src/components/AgentStatusCard.tsx` | Ticket redemption (`POST /api/vpn/connect`, `POST /api/vpn/disconnect`), in-memory Curve25519 keygen, PostgreSQL advisory-locked IPAM (`10.13.13.0/24`), agent version & device fingerprint checks, `wireguard.exe` tunnel activation (`mango0`), and Portal status UI |
| **#10** | 5. Role-based Zero-Trust policies (ALLOW/DENY, nftables enforcement, Admin CRUD) | ✅ Completed & Merged | `Sobree/vpn-daemon/main.go`, `Rain/admin/src/policies.ts`, `Rain/portal/src/components/PoliciesTab.tsx` | `nftables` `inet mango_vpn forward` deny-by-default rules (`ALLOW`/`DENY`), Admin Policy CRUD routes, and live gateway policy sync (`POST /policies/sync`) |
| **#11** | 6. Admin Users, Devices, live session kick, and real-time revocation | ✅ Completed & Merged | `Rain/admin/src/users.ts`, `devices.ts`, `sessions.ts`, `revocation.ts` | Admin CRUD for Users, Devices, and Sessions with daemon-first peer removal before DB revocation/disconnect commits |
| **#12** | 7. Admin Audit Logs and Agent Version registry | ✅ Completed & Merged | `Rain/admin/src/index.ts`, `audit.ts`, `agent-versions.ts`, `Rain/portal/src/components/*Tab.tsx` | Paginated & filterable Audit Logs, Agent Version registry, and all 6 Admin Portal tabs (`UsersTab`, `DevicesTab`, `SessionsTab`, `PoliciesTab`, `AuditLogsTab`, `AgentVersionsTab`) with honest empty/error states and zero `MOCK_*` fallbacks |
| **#13** | 8. Docker Compose & AWS/Windows VM deployment verification | ✅ Completed & Merged | `docker-compose.yml`, `.env.example`, `Sobree/api/Dockerfile`, `Sobree/vpn-daemon/Dockerfile`, `Rain/portal/Dockerfile`, `Rain/portal/docker-entrypoint.sh` | Multi-stage Dockerfiles, Compose wiring (`NET_ADMIN` only, no `SYS_MODULE`), runtime portal config injection (`window.__MANGO_ENV__`), and local/AWS `.env.example` profiles |

---

## 3. Component Readiness Matrix

| Component | Path | Build / Test Status | Runtime / Deployment Readiness |
| :--- | :--- | :--- | :--- |
| **Shared Contracts** | `packages/shared` (`@mango/shared`) | ✅ Compiles (`tsc`) | Ready (`DeletePolicyResponse` cleanup tracked in `#19`) |
| **Control Plane API** | `Sobree/api` (`@mango/api`) | ✅ Compiles & `40/40` tests pass (vs `mangovpn` & `mangovpn_v2_test`) | Auto-loads root `.env`, cleans rotated device keys on reconnect; production auth hardening in `#19` |
| **Admin CRUD Plugin** | `Rain/admin` (`@mango/rain-admin`) | ✅ Compiles & `3/3` seed tests pass | Mounted under `/api` in `Sobree/api/src/app.ts`; `seed.ts` auto-loads root `.env` |
| **Web Portal UI** | `Rain/portal` (`@mango/portal`) | ✅ Compiles (`tsc && vite build`) & `27/27` tests pass | Ready (`nginx.conf` added, LF `docker-entrypoint.sh`, Vite pinned to `:3000`, honest error-vs-empty states & `priority: 0` fixed) |
| **Windows Agent** | `Sobree/agent-windows` | ✅ `go vet` & `8/8` `go test` pass (Go `1.26.0`) | Supports `AGENT_*` + `MANGO_AGENT_*` aliases; live `wireguard.exe` tunnel test tracked in `#21` |
| **Linux VPN Daemon** | `Sobree/vpn-daemon` | ✅ `go vet` & `9/9` `go test` pass (Go `1.22`) | Containerized (`mango-vpn-gateway` healthy with `wg0` + `nftables`); concurrency serialization tracked in `#20` |
| **Loopback Simulator** | `scripts/mock-agent.js` | ✅ Guardrails pass; synchronized with v2 agent contract | Ready for local Portal dev (`npm run mock:agent`) |
| **Docker & CI** | `docker-compose.yml`, `.github/workflows/ci.yml` | ✅ 4/4 Compose containers healthy; CI Go `1.26`, `prisma migrate deploy`, & `windows-agent-tests` configured | Loopback `127.0.0.1:50051` exposed for host API dev |

---

## 4. What Needs To Be Done (Action Items)

### High Priority — Dev / Testing / CI Readiness (Resolved)

- [x] **1. Add `Rain/portal/nginx.conf` and fix `docker-entrypoint.sh` line endings (Docker Blocker)**
  - Added [`Rain/portal/nginx.conf`](Rain/portal/nginx.conf) listening on `:3000` with SPA fallback (`try_files $uri $uri/ /index.html;`) and `Cache-Control: no-store` on `/env-config.js`.
  - Converted [`Rain/portal/docker-entrypoint.sh`](Rain/portal/docker-entrypoint.sh) from CRLF to LF and added [`.gitattributes`](.gitattributes) (`*.sh text eol=lf`).

- [x] **2. Align Go version, Prisma deploy, and Windows tests in `.github/workflows/ci.yml`**
  - Updated `go-version` from `'1.23'` to `'1.26'`, added `npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma` before `npm test`, and added the `windows-agent-tests` job on `windows-latest`.

- [x] **3. Provision local `.env`, enable root `.env` auto-loading, and reset `mangovpn` DB to v2**
  - Created untracked root `.env` with cryptographic secrets and a Curve25519 keypair, reset `mangovpn` cleanly to the v2 migrations, and seeded `admin`.
  - Updated [`Sobree/api/src/server.ts`](Sobree/api/src/server.ts) and [`Rain/admin/src/seed.ts`](Rain/admin/src/seed.ts) to fall back to loading the monorepo root `.env` when run via workspace scripts.
  - Pinned port `3000` in [`Rain/portal/vite.config.ts`](Rain/portal/vite.config.ts), fixed false empty-state rendering on errors across 5 Admin tabs + `priority: 0` coercion in [`PoliciesTab.tsx`](Rain/portal/src/components/PoliciesTab.tsx), aligned env aliases in `Sobree/agent-windows/main.go` / `scripts/mock-agent.js` / `.env.example`, and cleaned up rotated ephemeral keys on reconnect in `Sobree/api/src/modules/vpn/vpn.routes.ts`.

- [x] **4. Run and verify the full 4-container Docker Compose stack end-to-end**
  - Bound `127.0.0.1:${DAEMON_PORT:-50051}:50051` on `vpn-gateway` in [`docker-compose.yml`](docker-compose.yml) so host-run `npm run dev:api` can reach the containerized daemon.
  - Verified `docker compose up -d --build` reaches `healthy` across `mango-postgres`, `mango-vpn-gateway`, `mango-api`, and `mango-portal`, and confirmed `/health`, `/env-config.js`, `wg show`, `nft list table inet mango_vpn`, and `POST /api/auth/login`.

### Deferred — Pre-Production Hardening & Live Cloud/Windows Rollout

- [ ] **5. Production hardening & live environment rollout (Tracked in GitHub Issues)**
  - **Issue `#19`** (`ready-for-agent`): Atomic refresh-token reuse check inside `prisma.$transaction`, authenticate/authorize `POST /api/vpn/disconnect`, wire `recordAuthAuditEvent` into auth routes, require `WG_SERVER_PUBLIC_KEY` in production, and add `DeletePolicyResponse` DTO + URL-encoded IDs.
  - **Issue `#20`** (`ready-for-agent`): Serialize `applyNftables` execution in `Sobree/vpn-daemon/main.go`, validate `WG_PRIVATE_KEY` at startup, expand Go concurrency/failure-rollback unit tests, and add semantic version comparisons to `scripts/check-environment.ps1`.
  - **Issue `#21`** (`ready-for-human`): Verify live `wireguard.exe` `mango0` tunnel bring-up/teardown on an elevated Windows host/VM, provision AWS EC2 Profile B with TLS reverse proxy (`:443` -> `:3000`/`:4000`, block `:15432`), and publish the signed Windows Agent binary in Admin **Agent Versions**.

### Low Priority — Git Housekeeping

- [ ] **6. Clean up stale local and remote branches**
  - Delete merged local branches (`chore/post-reset-cleanup`, `docs/v2-walkthrough-and-progress`) and prune obsolete pre-v2 remote branches after confirming with Rain and Sobree.

---

## 5. Verification Commands Cheat Sheet

```powershell
# 1. Security & anti-mock guardrails
node scripts/check-guardrails.mjs

# 2. Full monorepo TypeScript build (@mango/shared first)
npm run build

# 3. Monorepo tests (requires a PostgreSQL DB migrated to v2 schema)
$env:DATABASE_URL="postgresql://mango:mangosecret@localhost:15432/mangovpn_v2_test?schema=public"
npm test
Remove-Item Env:DATABASE_URL

# 4. Go modules verification
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

---

## 6. Comprehensive Walkthrough: Test, Run, Deploy Locally & Ship

> **Scope**: Verified against `fix/sobree-dev-test-audit-readiness` on 2026-11-20.

### Verified Architecture Notes

- **Agent platform string is `windows-x64`.** `Sobree/api/src/modules/vpn/vpn.routes.ts` calls `assertAgentVersionAllowed(prisma, agentVersion, 'windows-x64')`. Register agent versions with `platform: windows-x64`, not `windows-amd64`, or the version gate will not apply to real connects.
- **Agent version gate behavior.** `Rain/admin/src/agent-versions.ts` rejects invalid semver (`400 AGENT_VERSION_INVALID`), deactivated versions (`426 AGENT_VERSION_INACTIVE`), and versions below the highest active mandatory version (`426 AGENT_VERSION_OUTDATED`). If no mandatory version is registered for the platform, the check passes.
- **VPN daemon reachability.** `/api/vpn/connect` calls `vpnDaemon.addPeer` before returning, and marks the session disconnected (`502`) on failure. Revoke, disconnect, and deactivate call the daemon first and leave the database unchanged on failure. `docker-compose.yml` binds `127.0.0.1:50051:50051` so host-run `npm run dev:api` reaches `http://127.0.0.1:50051`, while the `api` container uses `http://vpn-gateway:50051`.
- **Seed from the host, not inside the API container.** The runtime stage of `Sobree/api/Dockerfile` copies `Rain/admin/dist`, not `Rain/admin/src`. Run `npm run db:seed` from the host; `seed.ts` automatically loads root `.env`.
- **Compose port publishing.** `docker-compose.yml` binds `15432` (Postgres), `4000` (API), and `3000` (Portal) on host interfaces and `127.0.0.1:50051` for the daemon. Block `15432` in cloud security groups and place `:3000`/`:4000` behind a TLS reverse proxy in production (`#21`).

### Port Map (verified)

| Port | Component | Where it is reachable |
| :--- | :--- | :--- |
| `3000` | Portal (`npm run dev:portal` or `mango-portal` container) | Host |
| `4000` | Control plane API (`PORT`/`API_PORT`) | Host |
| `15432` | PostgreSQL host port (`POSTGRES_PORT`), mapped to `5432` in the container | Host |
| `47821` | Windows Agent or `scripts/mock-agent.js` | `127.0.0.1` only |
| `51820/udp` | WireGuard (`WG_LISTEN_PORT`) | Host and internet, when published |
| `50051` | VPN gateway daemon HTTP API | `mango-net` + host loopback `127.0.0.1:50051` |

---

### 6.1 Prerequisites & Environment Readiness

1. **Run the tool readiness check (`npm run check:env`).** Verifies `Node.js >= 18`, `npm >= 9`, `Git >= 2.30`, `Docker >= 24`, `Docker Compose >= v2.20`, and `Go` (`1.26.0` for `agent-windows`, `1.22` for `vpn-daemon`).
2. **Install dependencies and build the baseline:**
   ```powershell
   npm install
   npm run build
   ```
3. **Create `.env` from `.env.example` and populate strong secrets:**
   ```powershell
   copy .env.example .env
   openssl rand -base64 32   # distinct values for JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
   openssl rand -hex 32      # 64 hex chars for TOTP_ENCRYPTION_KEY
   ```
   Set `POSTGRES_PASSWORD`, `DATABASE_URL`, and a WireGuard keypair (`WG_PRIVATE_KEY` and `WG_SERVER_PUBLIC_KEY`).

---

### 6.2 Database Setup, Migration & Admin Seeding

1. **Start PostgreSQL:**
   ```powershell
   docker compose up -d postgres
   docker compose ps postgres
   ```
2. **Apply migrations (or reset a stale v1 DB):**
   ```powershell
   npm run db:generate
   npm run db:migrate
   # If upgrading from a stale v1 schema:
   # npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
   ```
3. **Seed roles (`ADMIN`, `STAFF`, `CLIENT`) and the initial `ADMIN` user:**
   ```powershell
   $env:SEED_ADMIN_USERNAME="admin"
   $env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
   npm run db:seed
   Remove-Item Env:SEED_ADMIN_PASSWORD
   ```

---

### 6.3 Automated Tests & Guardrails

```powershell
# 1. Security & anti-mock guardrails (0 violations)
node scripts/check-guardrails.mjs

# 2. Full monorepo TypeScript build (@mango/shared first)
npm run build

# 3. Vitest suite (70 tests: 3 admin, 27 portal, 40 api)
$env:DATABASE_URL="postgresql://mango:<password>@localhost:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
Remove-Item Env:DATABASE_URL

# 4. Go vet, test & build
cd Sobree/agent-windows; go vet ./...; go test ./...; go build ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; go build ./...; cd ../..
```

---

### 6.4 Running Locally for Development (Two Workflows)

#### Workflow A: Portal & Admin Dev with `mock-agent.js` (Rain)

*(Stop any running Docker `api`/`portal` containers with `docker compose stop api portal` if ports `3000`/`4000` are in use.)*

1. **Terminal 1 — Local Windows Agent Simulator (`127.0.0.1:47821`):** `npm run mock:agent` (copy the printed `PairingToken`).
2. **Terminal 2 — Control Plane API (`:4000`):** `npm run dev:api` (auto-loads root `.env`; optionally keep `docker compose up -d vpn-gateway` running so `/api/vpn/connect` reaches `127.0.0.1:50051`).
3. **Terminal 3 — Web Portal (`:3000`):** `npm run dev:portal` (pinned to `:3000` in `Rain/portal/vite.config.ts`).

#### Workflow B: Full Systems Dev with Go Windows Agent & Linux Gateway (Sobree)

```powershell
# 1. Database and gateway containers (exposes 127.0.0.1:50051 for host API)
docker compose up -d postgres vpn-gateway

# 2. Host Control Plane API (:4000)
npm run dev:api

# 3. Windows Agent (in an Administrator PowerShell with WireGuard for Windows installed)
cd Sobree/agent-windows
$env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
$env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
$env:AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
$env:API_URL="http://localhost:4000"
go run .
```

---

### 6.5 Local Full-Stack Docker Compose Deployment

```powershell
docker compose up -d --build
docker compose ps
```

All four services (`mango-postgres`, `mango-vpn-gateway`, `mango-api`, `mango-portal`) report `healthy`. `mango-api` runs `prisma migrate deploy` on boot and `mango-portal` writes `/usr/share/nginx/html/env-config.js` at startup via `40-mango-env.sh`. Seed from the host via `npm run db:seed`.

---

### 6.6 Pre-Release & Cloud Production Checklist

1. **Hardening follow-ups (`#19`, `#20`):** Land atomic refresh-token reuse detection, authenticated `/api/vpn/disconnect`, auth audit logging, `applyNftables` serialization, and Go concurrency tests.
2. **Provision remote AWS EC2 Linux host (Profile B, `#21`):** Open UDP `51820` and HTTPS `443` via reverse proxy/ALB (`vpn.example.com` -> `:3000`, `api.vpn.example.com` -> `:4000`); block `15432` externally; set production `.env` secrets and `WG_SERVER_ENDPOINT`.
3. **Build, register & roll out Windows Service Agent (`#21`):** Build `mango-agent-windows.exe`, record `Get-FileHash -Algorithm SHA256`, register `windows-x64` release in Admin **Agent Versions**, and verify live `mango0` tunnel activation/revocation with `wg show` and `nft list table inet mango_vpn`.
