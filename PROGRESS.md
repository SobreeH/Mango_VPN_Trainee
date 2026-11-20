# MANGO VPN v2 — Project Progress & Remaining Work Tracker

> **Last Verified**: 2026-11-20  
> **Active Branch**: `main` (at `20d89c8` — PR #16 merged after v2 rebuild PR #15)  
> **Tracked Epic**: GitHub Issue `#5` (`MANGO VPN v2: Complete Zero-Trust WireGuard Rebuild`) — Tickets `#6`–`#13` closed

---

## 1. Project Status Overview

MANGO VPN v2 (`0.2.0`) is a **Zero-Trust Role-Based WireGuard Remote Access & Policy Management System**. All 8 implementation tickets (`#6`–`#13`) under Epic `#5` have been completed, merged into `main`, and cleaned up (`PR #15` and `PR #16`). The core application, shared contracts, Prisma schema, Go Windows Agent, Go Linux VPN Daemon, Portal UI, and Admin CRUD compile and pass unit/integration tests.

However, **deployment and local developer environment readiness still have open blockers**—most notably a missing `Rain/portal/nginx.conf` required by `Rain/portal/Dockerfile`, a Go version mismatch in `.github/workflows/ci.yml`, no root `.env` file yet, and an outdated v1 migration state in the local `mangovpn` PostgreSQL database.

### Automated Verification Snapshot (2026-11-20)

| Check | Command | Scope / Target | Result |
| :--- | :--- | :--- | :--- |
| Security & Anti-Mock Guardrails | `node scripts/check-guardrails.mjs` | `Rain/`, `Sobree/`, `packages/`, `docker-compose.yml` | ✅ **PASS** (`0` violations) |
| TypeScript Monorepo Build | `npm run build` | `@mango/shared`, `@mango/rain-admin`, `@mango/portal`, `@mango/api` | ✅ **PASS** (`4/4` workspaces) |
| Monorepo Test Suite | `npm test` | `DATABASE_URL=.../mangovpn_v2_test` | ✅ **PASS** (`68/68` tests: `3` admin, `26` portal, `39` api) |
| Windows Agent Go Checks | `cd Sobree/agent-windows && go vet ./... && go test ./...` | `github.com/mango-vpn/agent-windows` | ✅ **PASS** (cached) |
| VPN Daemon Go Checks | `cd Sobree/vpn-daemon && go vet ./... && go test ./...` | `github.com/mango-vpn/vpn-daemon` | ✅ **PASS** (cached) |
| Default Local DB Check | `npm test` against default `mangovpn` DB | `localhost:15432/mangovpn` | ⚠️ **FAIL** (DB still holds stale v1/partial migrations; `mangovpn_v2_test` has v2 schema) |

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
| **Shared Contracts** | `packages/shared` (`@mango/shared`) | ✅ Compiles (`tsc`) | Ready |
| **Control Plane API** | `Sobree/api` (`@mango/api`) | ✅ Compiles & `39/39` tests pass (vs `mangovpn_v2_test`) | Needs local `.env` and v2 reset on default `mangovpn` DB |
| **Admin CRUD Plugin** | `Rain/admin` (`@mango/rain-admin`) | ✅ Compiles & `3/3` seed tests pass (vs `mangovpn_v2_test`) | Mounted under `/api` in `Sobree/api/src/app.ts`; needs DB reset & `db:seed` |
| **Web Portal UI** | `Rain/portal` (`@mango/portal`) | ✅ Compiles (`tsc && vite build`) & `26/26` tests pass | ⚠️ **Blocked in Docker**: `Rain/portal/Dockerfile` expects missing `Rain/portal/nginx.conf` |
| **Windows Agent** | `Sobree/agent-windows` | ✅ `go vet` & `go test` pass (Go `1.26.0`) | ⚠️ CI workflow specifies Go `1.23`; live `wireguard.exe` tunnel test pending on Windows host/VM |
| **Linux VPN Daemon** | `Sobree/vpn-daemon` | ✅ `go vet` & `go test` pass (Go `1.22`) | Containerized (`Dockerfile`); full stack Compose run pending portal `nginx.conf` |
| **Loopback Simulator** | `scripts/mock-agent.js` | ✅ Guardrails pass; synchronized with v2 agent contract | Ready for local Portal dev (`npm run mock:agent`) |
| **Docker & CI** | `docker-compose.yml`, `.github/workflows/ci.yml` | ⚠️ Portal image build blocked; CI Go version mismatched | See Section 4 Action Items |

---

## 4. What Needs To Be Done (Remaining Action Items)

### High Priority — Blocking Build / CI / Local Dev

- [ ] **1. Add missing `Rain/portal/nginx.conf` (Docker Blocker)**
  - `Rain/portal/Dockerfile` (line 25) runs `COPY Rain/portal/nginx.conf /etc/nginx/conf.d/default.conf` and exposes port `3000`, and `QUICKSTART.md` (line 194) warns that `Rain/portal/nginx.conf` is not in the repository yet.
  - Until added, `docker compose build portal` / `npm run docker:up` fails on the `portal` service.
  - Ensure the Nginx config listens on port `3000`, serves `/usr/share/nginx/html`, supports SPA routing fallback (`try_files $uri $uri/ /index.html;`), and does not cache `/env-config.js`.

- [ ] **2. Align Go version and tests in `.github/workflows/ci.yml` (CI Pipeline)**
  - `.github/workflows/ci.yml` (line 44) installs `go-version: '1.23'`, whereas `Sobree/agent-windows/go.mod` specifies `go 1.26.0` (with `golang.org/x/sys v0.50.0`).
  - Update `ci.yml` to a compatible Go version (or align `go.mod`) and add `go test ./...` for `Sobree/agent-windows` alongside `go vet` and `go build`.

- [ ] **3. Create local `.env` and reset default `mangovpn` PostgreSQL database to v2 (Local Dev Setup)**
  - No `.env` file exists at the repository root (`Test-Path .env` is `False`). Copy `.env.example` to `.env` and populate unique 32+ character secrets (`JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET`) and a 64-hex `TOTP_ENCRYPTION_KEY`.
  - In the running `mango-postgres` container (`localhost:15432`), the default `mangovpn` database still contains the legacy v1 migration (`20261119043514_init`) and an unfinished v2 entry (`20261120021325_init`), causing `npm test` against `mangovpn` to fail with missing v2 types/tables (`public.RoleName`, `public.connect_tickets`). Reset `mangovpn` cleanly and seed an admin account:
    ```powershell
    npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
    $env:SEED_ADMIN_USERNAME="admin"
    $env:SEED_ADMIN_PASSWORD="<12+-char-password>"
    npm run db:seed
    ```

### Medium Priority — End-to-End & Live Environment Verification

- [ ] **4. Run and verify the full Docker Compose stack end-to-end**
  - Once `Rain/portal/nginx.conf` and `.env` are in place, run `npm run docker:up` and confirm all four containers (`mango-postgres`, `mango-vpn-gateway`, `mango-api`, `mango-portal`) reach healthy status and communicate over `mango-net` without mock fallbacks.

- [ ] **5. Verify live Windows WireGuard tunnel & cloud (AWS) deployment**
  - Run `Sobree/agent-windows` on a Windows host/VM with **WireGuard for Windows** (`wireguard.exe`) installed and Administrator privileges, verify live `mango0` tunnel creation/teardown and real `wg` + `nftables` policy enforcement against `vpn-gateway`:
    - **Profile A**: Local Windows + Docker Compose (`WG_SERVER_ENDPOINT=127.0.0.1:51820`)
    - **Profile B**: Remote AWS EC2 Linux gateway + Windows VM clients (per `.env.example`)

### Low Priority — Git Housekeeping

- [ ] **6. Clean up stale local and remote branches**
  - Delete merged local branch `chore/post-reset-cleanup`.
  - Prune obsolete pre-v2 remote branches (`origin/backup-rain-work-nov18`, `origin/feature/login-otp-refactor`, `origin/feature/rain-db-seeder`, `origin/feature/rain-fullstack-integration`, `origin/feature/v2-rebuild`) after confirming with Rain and Sobree.

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

# 4. Go modules verification
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

---

## 6. Comprehensive Walkthrough: Test, Run, Deploy Locally & Ship

> **Scope**: Every path, script, port, and variable below was checked against the repository on `main` (`20d89c8`) on 2026-11-20. Items marked ⚠️ are gaps or corrections found during that check. Do not mark a step done until its verification passes.

### Verified Corrections & Open Gaps

- **Agent platform string is `windows-x64`.** `Sobree/api/src/modules/vpn/vpn.routes.ts` (line 145) calls `assertAgentVersionAllowed(prisma, agentVersion, 'windows-x64')`. Register agent versions with `platform: windows-x64`, not `windows-amd64`, or the version gate will not apply to real connects.
- **Agent version gate behavior.** `Rain/admin/src/agent-versions.ts` rejects an invalid semver (`400 AGENT_VERSION_INVALID`), an explicitly deactivated version (`426 AGENT_VERSION_INACTIVE`), and a version below the highest active mandatory version (`426 AGENT_VERSION_OUTDATED`). If no mandatory version is registered for the platform, the check passes.
- ⚠️ **The VPN daemon is required for connect and revoke.** `/api/vpn/connect` calls `vpnDaemon.addPeer` before it commits, and returns `502` on failure with the session marked disconnected. Revoke, disconnect, and deactivate call the daemon first and leave the database unchanged on failure. The default `VPN_DAEMON_URL` is `http://127.0.0.1:50051` (`Sobree/api/src/config.ts`, line 68). `docker-compose.yml` publishes only `51820/udp` for `vpn-gateway`, so a **host-run API cannot reach the daemon**. Use the containerized API for end-to-end connects (see 6.4 Workflow B).
- ⚠️ **Seed from the host, not inside the API container.** The runtime stage of `Sobree/api/Dockerfile` copies `Rain/admin/dist`, not `Rain/admin/src`. The `seed` script is `tsx src/seed.ts`.
- ⚠️ **`.env` loading.** `Sobree/api/src/server.ts` imports `dotenv/config`, which reads `.env` from the process working directory. `npm --workspace` runs from the workspace folder, so the root `.env` may not be picked up by `npm run dev:api`. If the API reports missing configuration, export the variables in the terminal first.
- ⚠️ **Compose publishes Postgres to the host** as `${POSTGRES_PORT:-15432}:5432` on all interfaces. Compose also publishes the API (`4000`) and the portal (`3000`). This matters for cloud hosts (see 6.6).
- ⚠️ **Repository blockers:** `Rain/portal/nginx.conf` does not exist (`Rain/portal/Dockerfile` line 25 copies it), and `.github/workflows/ci.yml` line 44 installs Go `1.23` while `Sobree/agent-windows/go.mod` requires `go 1.26.0`.

### Port Map (verified)

| Port | Component | Where it is reachable |
| :--- | :--- | :--- |
| `3000` | Portal (Vite dev with `--port 3000`, or the `portal` container) | Host |
| `4000` | Control plane API (`PORT`/`API_PORT`) | Host |
| `15432` | PostgreSQL host port (`POSTGRES_PORT`), mapped to `5432` in the container | Host |
| `47821` | Windows Agent or `scripts/mock-agent.js` | `127.0.0.1` only |
| `51820/udp` | WireGuard (`WG_LISTEN_PORT`) | Host and internet, when published |
| `50051` | VPN gateway daemon HTTP API | `mango-net` only. Not published by compose |

---

### 6.1 Prerequisites & Environment Readiness

1. **Run the tool readiness check.**
   ```powershell
   npm run check:env
   ```
   This runs `scripts/check-environment.ps1` and reports Node.js (`>= 18`), npm (`>= 9`), Git, Docker, Docker Compose, and Go against their minimum versions. The agent needs Go `1.26`.

2. **Install dependencies and build the baseline** (from `QUICKSTART.md` section 6).
   ```powershell
   npm install
   npm run build
   ```

3. **Create `.env` from the template.**
   ```powershell
   copy .env.example .env
   ```
   Never commit `.env`. The `.env.example` header says the same.

4. **Generate strong secrets** (`openssl`, as documented in `.env.example`).
   ```powershell
   openssl rand -base64 32   # JWT_SECRET (>= 32 chars)
   openssl rand -base64 32   # REFRESH_SECRET (>= 32 chars)
   openssl rand -base64 32   # DAEMON_SHARED_SECRET (>= 32 chars)
   openssl rand -hex 32      # TOTP_ENCRYPTION_KEY (exactly 64 hex chars)
   ```
   - The API fails fast on missing or short `JWT_SECRET`, `REFRESH_SECRET`, or `DAEMON_SHARED_SECRET`.
   - Do not leave the all-zero `TOTP_ENCRYPTION_KEY` placeholder from `.env.example`.
   - Replace `POSTGRES_PASSWORD` and the `replace-with-...` entries in `DATABASE_URL`.

5. **Generate the WireGuard server keypair.** Keep the values in memory and paste them into `.env`. Do not write them to a file. `wg.exe` ships with WireGuard for Windows.
   ```powershell
   $wgPrivate = wg genkey
   $wgPublic = $wgPrivate | wg pubkey
   Write-Output "WG_PRIVATE_KEY=$wgPrivate"
   Write-Output "WG_SERVER_PUBLIC_KEY=$wgPublic"
   ```
   Set `WG_PRIVATE_KEY` and `WG_SERVER_PUBLIC_KEY` in `.env`. `WG_PRIVATE_KEY` is read by `vpn-gateway`. `WG_SERVER_PUBLIC_KEY` is read by `api` and returned to clients on connect.

6. **Set the local endpoint** for Profile A in `.env` (from `.env.example`):
   ```text
   WG_SERVER_ENDPOINT=127.0.0.1:51820
   CORS_ORIGIN=http://localhost:3000
   VITE_API_URL=http://localhost:4000
   VITE_AGENT_URL=http://127.0.0.1:47821
   PORTAL_PORT=3000
   ```

7. **Check for placeholders and ports.**
   ```powershell
   Select-String -Path .env -Pattern 'replace-with|^TOTP_ENCRYPTION_KEY=0{64}$'
   Get-NetTCPConnection -LocalPort 3000,4000,15432,47821,51820 -ErrorAction SilentlyContinue
   ```
   The first command should print nothing. The second should show no listeners you did not expect.

---

### 6.2 Database Setup, v2 Migration Reset & Admin Seeding

1. **Start PostgreSQL** (container `mango-postgres`, host port `15432`).
   ```powershell
   docker compose up -d postgres
   docker compose ps postgres
   ```
   Wait for the `healthy` status (`pg_isready` healthcheck).

2. **Point `DATABASE_URL` at the local `mangovpn` database** (from `.env`, host port `15432`):
   ```text
   DATABASE_URL=postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:15432/mangovpn?schema=public
   ```

3. **Reset `mangovpn` to the v2 schema.** The stale v1 migration `20261119043514_init` and the partial v2 entry `20261120021325_init` are why `npm test` fails against this database (see `PROGRESS.md` section 4, item 3).
   ```powershell
   npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
   ```
   > [!WARNING]
   > `migrate reset` **drops all data** in the database that `DATABASE_URL` points to. Confirm the database name before you run it. Do not run it against a database you want to keep.

4. **Regenerate the client and confirm migrations are in sync.**
   ```powershell
   npm run db:generate
   npm run db:migrate
   ```
   After a reset, `db:migrate` should report that the schema is already up to date.

5. **Verify the migration history.**
   ```powershell
   docker exec mango-postgres psql -U <POSTGRES_USER> -d mangovpn -c "SELECT migration_name FROM _prisma_migrations ORDER BY started_at;"
   ```
   The v1 entry `20261119043514_init` must not appear. Only the migrations in `Sobree/api/prisma/migrations/` should be listed.

6. **Seed the ADMIN, STAFF, and CLIENT roles and the initial ADMIN user** (`Rain/admin/src/seed.ts`).
   ```powershell
   $env:SEED_ADMIN_USERNAME="admin"
   $env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
   # Optional: $env:SEED_ADMIN_EMAIL="admin@example.com"
   npm run db:seed
   Remove-Item Env:SEED_ADMIN_PASSWORD
   ```
   - `SEED_ADMIN_PASSWORD` must be at least 12 characters. The seed throws if it is missing or short.
   - Never put a default password in source, `.env.example`, or the docs. Clear the variable from the shell after seeding.

---

### 6.3 Automated Tests & Guardrails

Run these in order. Stop at the first failure.

1. **Security and anti-mock guardrails** (must report `0` violations). CI runs this first.
   ```powershell
   node scripts/check-guardrails.mjs
   ```
   It scans `Rain/`, `Sobree/`, `packages/`, and `docker-compose.yml`.

2. **Monorepo TypeScript build.** The root `build` script builds `@mango/shared` first, then every workspace with a build script (`@mango/rain-admin`, `@mango/portal`, and `@mango/api`).
   ```powershell
   npm run build
   ```

3. **Monorepo tests** (68 tests: `3` in `@mango/rain-admin`, `26` in `@mango/portal`, and `39` in `@mango/api`). The API tests read `DATABASE_URL`, so point them at a **dedicated test database** that has the v2 schema, not your development data.
   ```powershell
   $env:DATABASE_URL="postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:15432/mangovpn_v2_test?schema=public"
   npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
   npm test
   Remove-Item Env:DATABASE_URL
   ```
   Create `mangovpn_v2_test` first if it does not exist:
   ```powershell
   docker exec mango-postgres psql -U <POSTGRES_USER> -d postgres -c "CREATE DATABASE mangovpn_v2_test;"
   ```

4. **Go checks.** The agent module requires Go `1.26.0`, and the daemon module requires Go `1.22`.
   ```powershell
   cd Sobree/agent-windows
   go vet ./...
   go test ./...
   cd ../vpn-daemon
   go vet ./...
   go test ./...
   cd ../..
   ```

---

### 6.4 Running Locally for Development (Two Workflows)

#### Workflow A: Portal & Admin Dev with `mock-agent.js` (Rain)

This workflow needs Node.js and PostgreSQL. It does not need Go, Docker for the API, or WireGuard. The mock agent does not bring up a real tunnel.

- **Terminal 1: mock agent**
  ```powershell
  npm run mock:agent
  ```
  - Listens on `http://127.0.0.1:47821` and prints a `PairingToken` at startup. The token is random for each start unless you set `AGENT_PAIRING_TOKEN`.
  - Default allowed origins are `http://localhost:3000,http://127.0.0.1:3000` (`AGENT_ALLOWED_ORIGINS`).
  - `/health` needs no token. `/status`, `/connect`, and `/disconnect` require the `X-Mango-Agent-Token` header.
  - Default upstream API is `http://localhost:4000` (`API_URL`).
- **Terminal 2: API**
  ```powershell
  npm run dev:api
  ```
  Listens on `:4000`. The default `CORS_ORIGIN` is `http://localhost:3000`.
- **Terminal 3: portal on port 3000**
  ```powershell
  npm --workspace=@mango/portal run dev -- --port 3000
  ```
  Vite's default port `5173` does not match the CORS origin, so `--port 3000` is required.

**Browser walkthrough** (`http://localhost:3000`):

1. **Log in** with the seeded admin (`SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD`). `POST /api/auth/login` returns `MFA_SETUP_REQUIRED` on first use, or `MFA_REQUIRED` after enrollment. The `mfaToken` is valid for 5 minutes.
2. **TOTP enrollment (first login only).** Scan the QR code built from `otpauthUri`, or enter `secretBase32` in your authenticator app. Then enter the 6-digit code. `POST /api/auth/verify-otp` sets `totpEnabled` on success.
3. **Pair the agent.** Paste the `PairingToken` from terminal 1 into the portal's `X-Mango-Agent-Token` field. The agent status card should show the mock agent as reachable.
4. **Register the agent version** in the **Agent Versions** tab: `version` `2.0.0`, `platform` `windows-x64`, a `downloadUrl` (`http` or `https`), `sha256Checksum`, `isActive` on. Without a registered version the gate passes, but the record makes future mandatory-version rules apply.
5. **Connect the VPN.** The portal calls `POST /api/vpn/ticket` and the mock agent calls `POST /connect` with the ticket. The API then allocates the first free address from `10.13.13.2` to `10.13.13.254` in `10.13.13.0/24`.
   > ⚠️ This step needs a VPN daemon reachable at `VPN_DAEMON_URL`. A native Linux daemon on `127.0.0.1:50051` (`cd Sobree/vpn-daemon && go run .`) is one option. Without it, connect returns `502`.
6. **Exercise the admin tabs**: **Users**, **Devices**, **Sessions**, **Policies**, **Audit Logs**, and **Agent Versions**. An empty list should show "No records found". A server error should show an error message, never fabricated data.
7. **Test real-time revocation and disconnect.** Revoke a device, disconnect a session, or deactivate a user. Each call removes the peer from the daemon first. Without a reachable daemon the call returns `502` and the database is left unchanged. This is correct behavior (`README.md` section 5).

#### Workflow B: Full Systems Dev with Go Windows Agent & Linux Gateway (Sobree)

```powershell
# 1. Database and gateway containers
docker compose up -d postgres vpn-gateway

# 2. API on the host (see the warning below before relying on connect)
npm run dev:api
```

3. **Register the agent version** `2.0.0` (`platform` `windows-x64`) in the Admin **Agent Versions** tab, or through `POST /api/agent-versions`.

4. **Run the Windows Agent** in an **Administrator** PowerShell with WireGuard for Windows installed. The variable names come from `.env.example`. They have not been re-verified against `Sobree/agent-windows/main.go`.
   ```powershell
   cd Sobree/agent-windows
   $env:MANGO_AGENT_ADDR="127.0.0.1:47821"
   $env:MANGO_AGENT_ALLOWED_ORIGINS="http://localhost:3000"
   $env:MANGO_AGENT_PAIRING_TOKEN="<your-local-pairing-token>"
   $env:MANGO_API_URL="http://localhost:4000"
   go run .
   ```
   The agent runs `wireguard.exe /installtunnelservice` to bring up interface `mango0`.

5. **Start the portal** on port 3000 (see the Workflow A command). Paste the same pairing token into the portal.

> ⚠️ **Host-run API cannot reach the gateway daemon.** `docker-compose.yml` publishes only `51820/udp` for `vpn-gateway`, so `127.0.0.1:50051` on the host is not connected to the daemon. Connect, revoke, and disconnect will return `502` from a host-run API. Two options:
> - **Run the API in the compose network.** `VPN_DAEMON_URL` is already set to `http://vpn-gateway:50051` for the `api` service, so `docker compose up -d --build api` gives a working connect path. The Windows agent still reaches it at `http://localhost:4000` because `API_PORT` is published.
> - **Publish `50051` on the host.** This requires editing `docker-compose.yml`, which is a protected boundary (see `AGENTS.md` section 3.C). Get explicit approval first.

---

### 6.5 Local Full-Stack Docker Compose Deployment

**Step 1: Create `Rain/portal/nginx.conf`** (blocker: `Rain/portal/Dockerfile` line 25 copies it to `/etc/nginx/conf.d/default.conf`, and the file is not in the repository). Expected content:

```nginx
server {
  listen 3000;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location = /env-config.js {
    add_header Cache-Control "no-store";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- `listen 3000` matches `EXPOSE 3000` and the image healthcheck (`wget http://127.0.0.1:3000/`).
- `try_files $uri $uri/ /index.html` provides SPA fallback for the React routes.
- `Cache-Control: no-store` on `/env-config.js` makes sure the runtime API and agent URLs are always fresh.

**Step 2: Build and start the full stack.**
```powershell
npm run docker:up        # docker compose up -d --build
```
What starts, in dependency order:

| Container | Image source | Startup behavior |
| :--- | :--- | :--- |
| `mango-postgres` | `postgres:16-alpine` | Waits for `pg_isready` |
| `mango-vpn-gateway` | `Sobree/vpn-daemon/Dockerfile` | `cap_add: NET_ADMIN` only, with `ip_forward` and `src_valid_mark` sysctls. Publishes `51820/udp`. Healthcheck on `:50051/health` inside the container |
| `mango-api` | `Sobree/api/Dockerfile` | Waits for postgres and vpn-gateway to be healthy. Runs `npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma`, then `node Sobree/api/dist/server.js`. Publishes `${API_PORT:-4000}` |
| `mango-portal` | `Rain/portal/Dockerfile` | `docker-entrypoint.sh` writes `/usr/share/nginx/html/env-config.js` from `VITE_API_URL` and `VITE_AGENT_URL` at each start. Publishes `${PORTAL_PORT:-3000}` |

Compose reads the root `.env` automatically. Missing required variables fail the start with the messages from `docker-compose.yml`.

Stop dev servers on ports `3000` and `4000` before you start the stack, or the publish will fail.

**Step 3: Seed the containerized database and verify health.**

Seed from the host through the published Postgres port (the `api` image does not include the seed source, see the corrections above):
```powershell
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
$env:DATABASE_URL="postgresql://<POSTGRES_USER>:<POSTGRES_PASSWORD>@localhost:15432/mangovpn?schema=public"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

Check container health:
```powershell
docker compose ps
```
All four services should show `healthy`. Each has a healthcheck in the repository: `postgres` (`pg_isready`), `vpn-gateway` (`wget :50051/health`), `api` (`wget :4000/health` from `Sobree/api/Dockerfile`), and `portal` (`wget :3000/` from `Rain/portal/Dockerfile`).

Spot-check the endpoints:
```powershell
Invoke-WebRequest http://localhost:4000/health -UseBasicParsing
Invoke-WebRequest http://localhost:3000/env-config.js -UseBasicParsing
Invoke-WebRequest http://localhost:3000/ -UseBasicParsing
```

---

### 6.6 What to Do to Ship It (Pre-Release & Cloud Production Checklist)

#### 1. Fix the 2 repository blockers on a feature or fix branch

`AGENTS.md` section 3.B: never commit directly to `main`.

```powershell
git status
git branch --show-current
git fetch origin
git switch -c feature/rain-portal-nginx-ci-go origin/main
```

- **Add `Rain/portal/nginx.conf`** (see 6.5, Step 1). This file is in `Rain/`, which is not a protected boundary. Then run `docker compose build portal` to confirm the image builds.
- **Fix the Go version in `.github/workflows/ci.yml` line 44:** change `go-version: '1.23'` to `go-version: '1.26'`, matching `Sobree/agent-windows/go.mod` (`go 1.26.0`).
  > ⚠️ `.github/` is a protected boundary (`AGENTS.md` section 3.C), and `.github/CODEOWNERS` routes it to `@SobreeH`. Get explicit approval before you edit it.
- **Add the agent test step.** The current step (`ci.yml` lines 62–68) runs only `GOOS=windows go vet` and `GOOS=windows go build`. A Linux runner cannot execute the Windows-only agent tests, so run `go test ./...` for `Sobree/agent-windows` on a `windows-latest` job.

Do not commit until the PR body lists the cross-boundary files (`AGENTS.md` section 3.B).

#### 2. Provision the remote Linux host (AWS EC2 — Profile B in `.env.example`)

- **Security group and network:**
  - Open **UDP `51820`** to the internet for WireGuard.
  - Open **TCP `443`** to the reverse proxy or ALB. Forward `vpn.example.com` to the portal (`:3000`) and `api.vpn.example.com` to the API (`:4000`).
  - Keep the daemon (`:50051`) and Postgres (`:5432`) private to `mango-net`. Compose does **not** publish `50051`.
  - ⚠️ Compose publishes `15432` (Postgres), `4000` (API), and `3000` (portal) on **all host interfaces**. The security group must block `15432` and must not expose `4000` or `3000` directly. Removing those publishes would require editing `docker-compose.yml`, which needs approval.
  - ⚠️ No reverse proxy or TLS configuration exists in this repository. You must provide it (ALB, Caddy, or nginx).

- **Production `.env`** (on the server only, never in git):
  ```text
  NODE_ENV=production
  JWT_SECRET=<random, >= 32 chars>
  REFRESH_SECRET=<random, >= 32 chars>
  DAEMON_SHARED_SECRET=<random, >= 32 chars>
  TOTP_ENCRYPTION_KEY=<64 hex chars>
  WG_PRIVATE_KEY=<server private key>
  WG_SERVER_PUBLIC_KEY=<server public key>
  WG_SERVER_ENDPOINT=<AWS_PUBLIC_IP_OR_DNS>:51820
  CORS_ORIGIN=https://vpn.example.com
  VITE_API_URL=https://api.vpn.example.com
  VITE_AGENT_URL=http://127.0.0.1:47821
  ```
  `VITE_API_URL` is also a Docker build argument. The entrypoint rewrites `env-config.js` at each start, so the runtime value wins.

- **Deploy and seed:**
  ```powershell
  docker compose up -d --build
  docker compose ps
  ```
  Seed the admin from a shell on the host with `DATABASE_URL` pointing to `localhost:15432`, as in 6.5 Step 3. Do not expose `15432` to the internet.

#### 3. Build, register & roll out the Windows Service Agent (`Sobree/agent-windows`)

- **Build the release binary** (PowerShell):
  ```powershell
  cd Sobree/agent-windows
  $env:GOOS="windows"
  $env:GOARCH="amd64"
  go build -trimpath -ldflags="-s -w" -o mango-agent-windows.exe .
  Remove-Item Env:GOOS, Env:GOARCH
  ```

- **Hash the binary:**
  ```powershell
  Get-FileHash .\mango-agent-windows.exe -Algorithm SHA256
  ```

- **Register the version** in the portal's **Agent Versions** tab. The fields are `version`, `platform`, `downloadUrl`, `sha256Checksum`, `isActive`, and `isRequired` (`Rain/admin/src/agent-versions.ts`):
  - `version`: `2.0.0`
  - `platform`: `windows-x64` (not `windows-amd64`, see the corrections above)
  - `downloadUrl`: an `https` URL where the `.exe` is hosted
  - `sha256Checksum`: the hash from `Get-FileHash`. The API lowercases it.
  - `isActive`: `true`
  - `isRequired`: `true` only if clients below this version must be blocked

- **Install on Windows clients** with WireGuard for Windows installed, using the variables from `.env.example`:
  ```text
  MANGO_AGENT_ADDR=127.0.0.1:47821
  MANGO_AGENT_ALLOWED_ORIGINS=https://vpn.example.com
  MANGO_AGENT_PAIRING_TOKEN=<per-machine-token>
  MANGO_API_URL=https://api.vpn.example.com
  ```
  Use a unique pairing token per machine. The portal user enters that token in the pairing field. The repository does not document how the agent is installed as a Windows service. See `Sobree/agent-windows/service_windows.go` for the service wrapper.

#### 4. Final production smoke & zero-trust audit

Mark each item done only when it passes (`AGENTS.md` Rule 2).

- [ ] **TOTP enrollment.** First login shows the QR code and the 6-digit verify succeeds. The next login returns `MFA_REQUIRED`.
- [ ] **Connect ticket.** `POST /api/vpn/ticket` returns a ticket that expires in 60 seconds. Redeeming it a second time returns `401` ("already redeemed"). An expired ticket returns `401`.
- [ ] **Agent loopback security.** A request from an origin outside `MANGO_AGENT_ALLOWED_ORIGINS` returns `403 FORBIDDEN_ORIGIN`. A request without a valid `X-Mango-Agent-Token` returns `401 INVALID_PAIRING_TOKEN` (both are enforced in `scripts/mock-agent.js`. Confirm the Go agent in `Sobree/agent-windows/main.go` behaves the same, since that file was not re-read for this section).
- [ ] **Agent version gate.** A deactivated or outdated version is rejected with `426` (`AGENT_VERSION_INACTIVE` or `AGENT_VERSION_OUTDATED`).
- [ ] **Peer registration.** `docker exec mango-vpn-gateway wg show` lists the new peer with its assigned `10.13.13.x` address. The interface name is `WG_INTERFACE` (default `wg0`).
- [ ] **Role policy enforcement.** `docker exec mango-vpn-gateway nft list table inet mango_vpn` shows the ALLOW and DENY rules for the user's role.
- [ ] **Instant teardown.** Revoking a device, disconnecting a session, or deactivating a user removes the peer from `wg show` and the rules from `nft`. Confirm the Windows `mango0` tunnel comes down. If the daemon call fails, the database must remain unchanged (`502`).
- [ ] **Live Windows tunnel.** `wireguard.exe` brings up `mango0` on connect and removes it on disconnect (`PROGRESS.md` section 4, item 5).
- [ ] **Secret audit.** `node scripts/check-guardrails.mjs` reports `0` violations on the release branch. `.env` is not tracked by git.

---

## 6. Comprehensive Walkthrough: Test, Run, Deploy Locally & Ship

### 6.1 Prerequisites & Environment Readiness

1. **Check installed tooling** (`Node.js >= 18`, `npm >= 9`, `Git >= 2.30`, `Docker >= 24`, `Docker Compose >= v2.20`, `Go >= 1.22` / `1.26.0` for `agent-windows`, plus **WireGuard for Windows** if testing real tunnels):
   ```powershell
   npm run check:env
   ```
2. **Create `.env` from `.env.example`** at the repo root and generate unique secrets (never commit `.env`):
   ```powershell
   copy .env.example .env
   openssl rand -base64 32   # use distinct outputs for JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
   openssl rand -hex 32      # 64 hex chars for TOTP_ENCRYPTION_KEY
   ```
   - Also set `POSTGRES_PASSWORD`, `DATABASE_URL` (`postgresql://mango:<password>@localhost:15432/mangovpn?schema=public`), and WireGuard server keys (`WG_PRIVATE_KEY` & `WG_SERVER_PUBLIC_KEY`).

### 6.2 Database Setup, v2 Migration Reset & Admin Seeding

1. **Start PostgreSQL 16** (`mango-postgres` on host port `15432`):
   ```powershell
   docker compose up -d postgres
   ```
2. **Generate Prisma client and reset `mangovpn` to the v2 schema** *(required if your local `mangovpn` database still contains the legacy v1 `20261119043514_init` migration)*:
   ```powershell
   npm run db:generate
   npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
   ```
   *(On a fresh database, `npm run db:migrate` applies all v2 migrations cleanly.)*
3. **Seed roles (`ADMIN`, `STAFF`, `CLIENT`) and the initial admin user**:
   ```powershell
   $env:SEED_ADMIN_USERNAME="admin"
   $env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
   $env:SEED_ADMIN_EMAIL="admin@mangovpn.local"   # optional
   npm run db:seed
   ```

### 6.3 Running Automated Tests & Guardrails

Run all verification gates from the repository root:

```powershell
# 1. Security & anti-mock guardrail scanner (must report 0 violations)
node scripts/check-guardrails.mjs

# 2. Full TypeScript monorepo build (@mango/shared -> admin -> portal -> api)
npm run build

# 3. Vitest suite across all JS/TS workspaces (68 tests: 3 admin, 26 portal, 39 api)
# Point DATABASE_URL at your migrated PostgreSQL v2 database:
$env:DATABASE_URL="postgresql://mango:<password>@localhost:15432/mangovpn?schema=public"
npm test

# 4. Go vet & unit tests for both Go modules
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

### 6.4 Running Locally for Development (Two Workflows)

#### Workflow A — Portal & Admin Dev with `mock-agent.js` (Rain)

Runs the full UI + API + PostgreSQL flow on Windows without needing `wireguard.exe` or the Linux gateway daemon (`POST /api/vpn/connect` requires `vpn-gateway` running if testing real connect, or use `docker compose up -d vpn-gateway` alongside Postgres):

1. **Terminal 1 — Local Windows Agent Simulator (`127.0.0.1:47821`)**:
   ```powershell
   npm run mock:agent
   ```
   Copy the `PairingToken` printed at startup (or set `AGENT_PAIRING_TOKEN` in env).
2. **Terminal 2 — Control Plane API (`:4000`)**:
   ```powershell
   npm run dev:api
   ```
3. **Terminal 3 — Web Portal (`:3000`)** *(must pass `--port 3000` so Origin matches `CORS_ORIGIN` and `AGENT_ALLOWED_ORIGINS=http://localhost:3000`)*:
   ```powershell
   npm --workspace=@mango/portal run dev -- --port 3000
   ```
4. **End-to-End Browser Walkthrough (`http://localhost:3000`)**:
   - **Login & TOTP MFA**: Sign in with the seeded `ADMIN` credentials. On first login (`MFA_SETUP_REQUIRED`), scan the QR code (`otpauthUri` / `secretBase32`) into an authenticator app and verify a 6-digit code (`POST /api/auth/verify-otp`).
   - **Pair Agent**: Paste the simulator's `PairingToken` into the Portal's agent token field (sent as `X-Mango-Agent-Token`).
   - **Connect VPN**: Click **Connect VPN** -> Portal requests a 60s single-use ticket (`POST /api/vpn/ticket`) -> agent generates Curve25519 keys -> API allocates `10.13.13.x` IP and registers peer.
   - **Admin Console**: Exercise all 6 tabs (**Users**, **Devices**, **Sessions**, **Policies**, **Audit Logs**, **Agent Versions**) and verify live disconnect/revoke behavior and honest empty/error states.

#### Workflow B — Full Systems Dev with Go Windows Agent & Linux Gateway Container (Sobree)

1. **Start PostgreSQL + Linux VPN Gateway Container**:
   ```powershell
   docker compose up -d postgres vpn-gateway
   ```
2. **Start Control Plane API**:
   ```powershell
   npm run dev:api
   ```
3. **Run the Go Windows Agent** *(Administrator shell required for `wireguard.exe /installtunnelservice` on interface `mango0`)*:
   ```powershell
   $env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
   $env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
   $env:AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
   $env:API_URL="http://localhost:4000"
   cd Sobree/agent-windows
   go run .
   ```
   *(Set `AGENT_PAIRING_TOKEN` explicitly—if omitted, `main.go` generates an ephemeral token without printing its value to stdout.)*
4. **(Optional) Register Agent Version Policy**: In the Portal's **Agent Versions** tab, register platform `windows-x64` (`2.0.0`) if enforcing mandatory versions (`assertAgentVersionAllowed` checks `windows-x64`).

### 6.5 Local Full-Stack Docker Compose Deployment

`docker-compose.yml` orchestrates four services on `mango-net`: `postgres` (`15432:5432`), `vpn-gateway` (`NET_ADMIN` only, `51820/udp`, internal `:50051`), `api` (`4000:4000`), and `portal` (`3000:3000`).

1. **Step 1 (Unblock `portal` Docker build)**: Create `Rain/portal/nginx.conf` (required by `Rain/portal/Dockerfile` line 25):
   ```nginx
   server {
     listen 3000;
     server_name _;
     root /usr/share/nginx/html;
     index index.html;

     location = /env-config.js {
       add_header Cache-Control "no-store, no-cache, must-revalidate";
       try_files $uri =404;
     }

     location / {
       try_files $uri $uri/ /index.html;
     }
   }
   ```
2. **Step 2 (Build & start all 4 containers)**:
   ```powershell
   npm run docker:up
   # equivalent to: docker compose up -d
   ```
   - `mango-api` automatically runs `npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma` before starting `Sobree/api/dist/server.js`.
   - `mango-portal` executes `Rain/portal/docker-entrypoint.sh` at startup to inject `VITE_API_URL` and `VITE_AGENT_URL` into `/usr/share/nginx/html/env-config.js` (`window.__MANGO_ENV__`).
3. **Step 3 (Seed & verify healthchecks)**:
   ```powershell
   docker compose ps
   $env:DATABASE_URL="postgresql://mango:<password>@localhost:15432/mangovpn?schema=public"
   $env:SEED_ADMIN_USERNAME="admin"
   $env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
   npm run db:seed
   ```

### 6.6 What to Do to Ship It (Pre-Release & Cloud Production Checklist)

1. **Fix the Repository Blockers on a Feature/Fix Branch** *(never commit directly to `main` per `AGENTS.md` Rule 3.B)*:
   - [ ] Create and commit `Rain/portal/nginx.conf` so `docker compose build portal` succeeds.
   - [ ] Update `.github/workflows/ci.yml` line 44 from `go-version: '1.23'` to `'1.26'` (matching `Sobree/agent-windows/go.mod`) and add `go test ./...` for `Sobree/agent-windows`.
   - [ ] Align `.env.example` lines 60–63 comment variable names (`MANGO_AGENT_*` / `MANGO_API_URL`) with what `Sobree/agent-windows/main.go` actually reads (`AGENT_LISTEN_ADDR`, `AGENT_ALLOWED_ORIGINS`, `AGENT_PAIRING_TOKEN`, `API_URL`), or update `main.go` to support both.
2. **Provision Remote Linux Host (AWS EC2 — Profile B in `.env.example`)**:
   - [ ] Open firewall/Security Group ports: **UDP `51820`** (WireGuard) and **HTTPS `443`** (via Nginx/Caddy/ALB reverse proxy forwarding to Portal `:3000` and API `:4000`). Keep `vpn-gateway` `:50051` and `postgres` `:5432` internal to `mango-net`.
   - [ ] Set production `.env`: `NODE_ENV=production`, strong random secrets, generated `WG_PRIVATE_KEY` + `WG_SERVER_PUBLIC_KEY`, `WG_SERVER_ENDPOINT=<AWS_PUBLIC_IP_OR_DNS>:51820`, `CORS_ORIGIN=https://vpn.example.com`, and `VITE_API_URL=https://api.vpn.example.com`.
   - [ ] Start stack (`docker compose up -d --build`) and run `db:seed` for the initial `ADMIN` user.
3. **Build, Register & Roll Out the Windows Service Agent (`Sobree/agent-windows`)**:
   - [ ] Build the Windows binary:
     ```powershell
     cd Sobree/agent-windows
     $env:GOOS="windows"; $env:GOARCH="amd64"
     go build -trimpath -ldflags="-s -w" -o mango-agent-windows.exe .
     Get-FileHash .\mango-agent-windows.exe -Algorithm SHA256
     ```
   - [ ] Register the release (`version`: `2.0.0`, `platform`: `windows-x64`, `sha256Checksum`, `downloadUrl`, `isActive: true`) in the Portal's **Agent Versions** tab.
   - [ ] Install on client Windows machines alongside **WireGuard for Windows**, configured with `AGENT_LISTEN_ADDR=127.0.0.1:47821`, `AGENT_ALLOWED_ORIGINS=https://vpn.example.com`, `AGENT_PAIRING_TOKEN=<per-machine-token>`, and `API_URL=https://api.vpn.example.com`.
4. **Final Production Smoke & Zero-Trust Audit**:
   - [ ] Verify end-to-end login + TOTP enrollment + Connect Ticket redemption (`POST /api/vpn/ticket` -> `POST /api/vpn/connect`).
   - [ ] Verify inside `mango-vpn-gateway` that `wg show` shows the peer and `nft list table inet mango_vpn` enforces the role's `ALLOW`/`DENY` rules with default drop.
   - [ ] Verify real-time teardown: trigger Device Revoke, Session Disconnect, and User Deactivate in the Admin Portal and confirm immediate peer removal on `wg0` and `mango0`.
