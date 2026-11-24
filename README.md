# MANGO VPN

> A Zero-Trust Role-Based WireGuard Remote Access & Policy Management System.

MANGO VPN removes manual `.conf` file handling for corporate VPN users. Users sign in to a web portal with a password and an authenticator-app (TOTP) code. The control plane API issues a one-time connect ticket, and a local client agent (`Sobree/agent-windows`, which runs on Windows or Linux) generates a Curve25519 keypair in memory, registers it with the API, and brings up the WireGuard tunnel (`wireguard.exe` on Windows, `wg-quick` on Linux). A Linux gateway daemon programs WireGuard peers and role-based `nftables` policies. Admins manage users, devices, sessions, policies, audit logs, and agent versions from the portal.

---

## 📚 Documentation

- **[🎓 First-Time Beginner Tutorial & Testing Manual (`TUTORIAL.md`)](TUTORIAL.md)** *(หรือฉบับภาษาไทย [TUTORIAL.th.md](TUTORIAL.th.md))*: **Start here if it is your first time** — step-by-step setup for both Rain and Sobree, automatic `.env` generation, 3 run tracks, and click-by-click testing missions.
- **[🤖 AI Development & Project Scoping Guide (`AGENTS.md`)](AGENTS.md)**: **Mandatory reading for all AI coding assistants**: scope rules, cross-boundary collaboration, protected paths, and anti-hallucination guardrails.
- **[🚀 Quick Start & Environment Readiness Guide (`QUICKSTART.md`)](QUICKSTART.md)**: Tool prerequisites, `.env` setup, port map, first-time setup, interactive walkthrough, debugging, and shipping checklist.
- **[📊 Project Progress & Ship Tracker (`PROGRESS.md`)](PROGRESS.md)**: Current v2 verification status, completed tickets (`#5`–`#13`), component readiness matrix, and remaining pre-ship action items.

---

## 0. Stack (v2)

| Area | Technology (from the `package.json` and `go.mod` files) |
| :--- | :--- |
| Monorepo | npm workspaces (`Rain/*`, `Sobree/*`, `packages/*`). npm only; there is no pnpm workspace. |
| Web portal (`@mango/portal` 0.2.0) | React 18.3, Vite 5, Tailwind CSS 3, TanStack Query 5, Zod 4 |
| Control plane API (`@mango/api` 0.2.0) | Node.js >= 18, Fastify 4, Prisma 5, bcryptjs, jsonwebtoken |
| Database | PostgreSQL 16 (`postgres:16-alpine` in Docker Compose, or embedded via `npm run db:start` for Docker-free Rain) |
| Client Agent (`Sobree/agent-windows`) | Go 1.26 (`Sobree/agent-windows/go.mod`). Windows Service via `golang.org/x/sys/windows/svc` on Windows; `wg-quick` on Linux |
| VPN gateway daemon | Go 1.22 (`Sobree/vpn-daemon/go.mod`), `wg` and `nft` commands |
| Shared contracts | `@mango/shared` (`packages/shared/src/contracts.ts`) |

---

## 1. Repository Layout

The codebase is organized by **primary ownership** into two engineer directories plus shared contracts.

> [!IMPORTANT]
> **AI-Assisted Cross-Boundary Workflow**: While `Rain/` and `Sobree/` define primary ownership, **either developer's AI assistant may edit across `Rain/`, `Sobree/`, and `packages/shared/` on a feature branch** when a task requires full-stack integration. Always follow [`AGENTS.md`](AGENTS.md) before scoping or implementing changes.

```text
Mango_VPN_Trainee/
├── Rain/                              # 🌧️ [Rain] Web portal and admin CRUD
│   ├── portal/                        # @mango/portal: React 18 + Vite + Tailwind
│   │   ├── src/App.tsx                # Login -> TOTP step -> role-based dashboard
│   │   ├── src/api/auth.ts            # Login, verify-otp, refresh, logout calls
│   │   ├── src/api/agent.ts           # Client agent loopback client (/health, /status, /connect, /disconnect)
│   │   ├── src/components/            # AgentStatusCard and admin tabs (users, devices, sessions, policies, audit logs, agent versions)
│   │   ├── src/lib/env.ts             # API and agent base URL resolution
│   │   ├── public/env-config.js       # Dev placeholder for window.__MANGO_ENV__
│   │   ├── nginx.conf                 # Nginx SPA + /env-config.js no-store config (:3000)
│   │   ├── docker-entrypoint.sh       # Writes /env-config.js into the container at start
│   │   └── Dockerfile
│   └── admin/                         # @mango/rain-admin: Fastify plugin mounted under /api
│       ├── src/index.ts               # adminPlugin: authenticate + ADMIN role guard, audit-logs route
│       ├── src/users.ts               # /users, /users/:id/status
│       ├── src/devices.ts             # /devices, /devices/:id/revoke
│       ├── src/sessions.ts            # /sessions, /sessions/:id/disconnect
│       ├── src/policies.ts            # /policies
│       ├── src/agent-versions.ts      # /agent-versions
│       ├── src/audit.ts               # Audit log writer helpers
│       ├── src/revocation.ts          # Removes peers from the VPN daemon before revoke/disconnect is saved
│       └── src/seed.ts                # Seeds ADMIN/STAFF/CLIENT roles and an initial ADMIN user
│
├── Sobree/                            # ⚡ [Sobree] Control plane, Windows Agent, and gateway daemon
│   ├── api/                           # @mango/api: control plane on :4000
│   │   ├── prisma/schema.prisma       # PostgreSQL schema (11 models) and migrations/
│   │   ├── src/app.ts                 # buildApp(): CORS, /health, auth, VPN, and admin routes
│   │   ├── src/server.ts              # Process entrypoint (loads config, listens on PORT)
│   │   ├── src/config.ts              # Fail-fast environment validation
│   │   ├── src/middleware/auth.ts     # authenticate and requireRole
│   │   ├── src/modules/auth/          # Password login, TOTP MFA, refresh rotation, rate limiting
│   │   ├── src/modules/vpn/           # Connect tickets, connect/disconnect, IPAM (10.13.13.0/24)
│   │   ├── src/lib/vpn-daemon.ts      # Bearer-authenticated HTTP client for the gateway daemon
│   │   └── Dockerfile
│   ├── agent-windows/                 # Go client agent (Windows Service or console on Windows; console on Linux), 127.0.0.1:47821
│   │   ├── main.go                    # Loopback API, Origin allowlist, PNA headers, X25519 keygen, WireGuard activation (wireguard.exe or wg-quick)
│   │   ├── service_windows.go         # Windows Service wrapper
│   │   └── go.mod
│   └── vpn-daemon/                    # Go gateway daemon: `wg set` + `nft` policy enforcement
│       ├── main.go                    # Bearer-authenticated HTTP API (/peers, /policies/sync, /peers/remove)
│       ├── main_test.go
│       ├── Dockerfile
│       └── go.mod
│
├── packages/
│   └── shared/                        # 🤝 [Shared] @mango/shared
│       └── src/contracts.ts           # DTOs and enums shared by the portal, admin, API, and agent
│
├── scripts/
│   ├── init-env.mjs                   # Cross-platform .env + X25519 WireGuard keypair generator (npm run env:init)
│   ├── mock-agent.js                  # 🧪 Node loopback simulator of the client agent (127.0.0.1:47821); in dev it suffixes device fingerprints per origin port
│   ├── mock-daemon.js                 # 🧪 Dev-only simulator of the VPN gateway daemon API (127.0.0.1:50051, no wg/nftables enforcement)
│   ├── start-all-portals.mjs          # Launches Admin :3000, Staff :3001, and Client :3002 Vite dev servers together (npm run dev:portal:all)
│   ├── dev-db.mjs                     # Docker-free embedded PostgreSQL 16 runner (npm run db:start / db:reset-local; data in .local/postgres)
│   ├── check-guardrails.mjs           # Scanner for hardcoded secret fallbacks, MOCK_* data, wildcard agent CORS, SYS_MODULE
│   ├── check-environment.mjs          # Tool readiness check for Linux, macOS, and Windows (npm run check:env; use -- --role Rain for Docker-free Rain)
│   └── check-environment.ps1          # Windows PowerShell wrapper that delegates to check-environment.mjs
│
├── docs/agents/                      # Agent skill configuration (issue tracker, triage labels, domain docs)
├── .github/                           # CI workflow (ci.yml) and CODEOWNERS
├── docker-compose.yml                 # postgres, vpn-gateway, api, portal
├── .env.example                       # Environment template (copy to .env)
├── package.json                       # npm workspaces root
└── tsconfig.base.json                 # Root TypeScript compiler options
```

---

## 2. Decoupled Team Responsibilities

| Responsibility | Rain 🌧️ | Sobree ⚡ |
| :--- | :--- | :--- |
| **Workspace folder** | `Rain/` | `Sobree/` |
| **Web portal UI** | `Rain/portal` (primary ownership) | Architectural review |
| **Admin CRUD** | `Rain/admin` (`/api/users`, `/api/devices`, `/api/sessions`, `/api/policies`, `/api/agent-versions`, `/api/audit-logs`) | Mounts the plugin in `Sobree/api/src/app.ts` |
| **Database seeding** | `Rain/admin/src/seed.ts` | Prisma schema and migrations |
| **Backend core** | Consumes auth and VPN endpoints | `Sobree/api` (password + TOTP auth, refresh rotation, connect tickets, IPAM) |
| **Client agent** (`Sobree/agent-windows`) | Uses `scripts/mock-agent.js` for UI testing | `Sobree/agent-windows` (Go: Windows Service on Windows, or console on Linux with `wg-quick`) |
| **VPN gateway** | Optional: `npm run mock:daemon` (`scripts/mock-daemon.js`) for local UI, policy, and connect testing without Docker or `wg`/`nftables` enforcement | `Sobree/vpn-daemon` (Linux `wg` + `nftables`, run natively on Linux or in the Docker `vpn-gateway` container on Windows/Linux) |
| **Shared contracts** | Consumes `@mango/shared` | Defines `@mango/shared` |

---

## 3. Workflow for Rain

Rain works inside `Rain/` and only reads Sobree's API. **Rain's workflow needs no Docker**: Node.js and Git are enough. `npm run env:init` writes `.env` and its secrets and WireGuard keys, `npm run db:start` runs embedded PostgreSQL 16 (data in `.local/postgres`), `npm run mock:daemon` simulates the gateway daemon, and `npm run mock:agent` simulates the client agent. The `.env` file still needs its `POSTGRES_*`, `DATABASE_URL`, and secret values (see [QUICKSTART.md](QUICKSTART.md)).

The commands below are shown for PowerShell. They are plain `npm run` commands, so they work unchanged in Bash on Linux and macOS.

```powershell
# 0. Create .env with fresh secrets and an X25519 WireGuard keypair (cross-platform, terminal 0)
npm run env:init

# 1. Embedded PostgreSQL 16 on 127.0.0.1:15432 (terminal 1). Ctrl+C stops it cleanly.
npm run db:start

# 2. Prepare the schema and admin (setup terminal, while step 1 keeps running)
npm run db:generate
npm run db:migrate
npm run db:seed                      # needs SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD

# 3. Dev-only gateway daemon simulator on 127.0.0.1:50051 (terminal 2). No wg/nftables enforcement.
npm run mock:daemon

# 4. Local client agent simulator (terminal 3). It prints its PairingToken at startup.
npm run mock:agent

# 5. Management API (terminal 4)
npm run dev:api

# 6. Portal UI (terminal 5). Pick one of the following:
npm run dev:portal                   # Admin UI on http://localhost:3000 (default)
npm run dev:portal:all               # All three role portals at once (see below)
npm run dev:portal:admin             # Admin UI on :3000
npm run dev:portal:staff             # Staff UI on :3001
npm run dev:portal:client            # Client UI on :3002
```

- **Cross-platform `.env` setup**: `npm run env:init` (`scripts/init-env.mjs`) generates `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET`, `TOTP_ENCRYPTION_KEY`, and an X25519 `WG_PRIVATE_KEY` / `WG_SERVER_PUBLIC_KEY` pair. It runs identically on Windows, Linux, and macOS, writes UTF-8 without a BOM, and leaves an existing populated `.env` unchanged unless you pass `-- --force` (or `-- --wg-only` to refresh just the WireGuard keys). The manual `copy`/`cp` + `openssl` path still works.
- **Docker is not required** for this workflow. `npm run mock:daemon` avoids `502 Bad Gateway` on connect, policy, and revocation calls without Docker, but it does not program WireGuard or `nftables`. Use Docker Compose only for the full stack (Sobree / Track B and C).
- **Multi-role portal dev**: `npm run dev:portal:all` (`scripts/start-all-portals.mjs`) starts the Admin portal on `:3000`, the Staff portal on `:3001`, and the Client portal on `:3002` at the same time with color-coded prefixed logs. `npm run dev:portal:admin`, `npm run dev:portal:staff`, and `npm run dev:portal:client` start a single role on its port. `npm run dev:portal` keeps the default Admin `:3000`.
- **Portal UI**: Vite is configured in `Rain/portal/vite.config.ts` to run on `http://localhost:3000`, matching `CORS_ORIGIN` and `AGENT_ALLOWED_ORIGINS`. In dev, `Sobree/api` allows `http://localhost:3000`–`http://localhost:3002` (and the `127.0.0.1` equivalents) so the Staff and Client portals can call the API without extra CORS configuration.
- **Per-port fingerprint isolation**: In dev, `scripts/mock-agent.js` appends the browser origin port to the device fingerprint and hostname it reports (for example `mock-<hash>-3001`). Opening the Admin, Staff, and Client portals against the same mock agent therefore creates three distinct devices instead of colliding on one fingerprint.
- **Root `.env` auto-loading**: `npm run dev:api` and `npm run db:seed` automatically load `.env` from the monorepo root when present (without overriding shell environment variables).
- **Agent pairing**: Paste the mock agent's PairingToken into the portal's "Paste X-Mango-Agent-Token" field.
- **Admin CRUD**: Edit the modules in `Rain/admin/src/` (`index.ts` mounts them).
- **Seed the database**: Run `npm run db:seed`. It needs `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` (at least 12 characters) in the environment (or root `.env`).

---

## 4. Workflow for Sobree

Sobree works inside `Sobree/` and the shared contracts.

```powershell
# Start PostgreSQL 16 (host port 15432 by default)
docker compose up -d postgres

# Generate the Prisma client and apply migrations
npm run db:generate
npm run db:migrate

# Start the control plane API (Fastify, :4000)
npm run dev:api

# Client agent (Windows): runs as a console server unless started by the Service Control Manager.
# Use an Administrator PowerShell for real tunnels.
cd Sobree/agent-windows
go run .

# Gateway daemon on Windows: run it in the vpn-gateway container
docker compose up -d vpn-gateway
```

```bash
# Start PostgreSQL 16 (host port 15432 by default)
docker compose up -d postgres

# Generate the Prisma client and apply migrations
npm run db:generate
npm run db:migrate

# Start the control plane API (Fastify, :4000)
npm run dev:api

# Client agent (Linux): needs root (or CAP_NET_ADMIN) and wg-quick. -E keeps your AGENT_* variables.
cd Sobree/agent-windows
sudo -E go run .

# Gateway daemon on Linux (needs root or NET_ADMIN, plus ip, wg, and nft)
cd Sobree/vpn-daemon
sudo -E go run .
```

On Linux, `Sobree/agent-windows` writes its WireGuard config to `$TMPDIR/mango-vpn/mango0.conf` (usually `/tmp/mango-vpn/mango0.conf`) and runs `wg-quick up` on that file. On Windows it writes to `$env:TEMP\mango-vpn\mango0.conf` and runs `wireguard.exe /installtunnelservice`. Set `AGENT_PLATFORM` (for example `linux-x64` or `windows-x64`) only to override the platform string the agent reports; by default it is derived from the OS and architecture.

Run `go vet ./...` and `go test ./...` in each Go module before you push.

---

## 5. Connection Lifecycle (v2)

1. **Password login.** The portal calls `POST /api/auth/login` with a username and password. If the user has no TOTP enrolled yet, the response is `MFA_SETUP_REQUIRED` with an `otpauthUri` and `secretBase32` for the authenticator app. Otherwise the response is `MFA_REQUIRED`. Both return an `mfaToken` valid for 5 minutes.
2. **TOTP verification.** The user enters the 6-digit code from their authenticator app. The portal calls `POST /api/auth/verify-otp` with `mfaToken` and `code`. On first enrollment, the successful code also sets `totpEnabled`. No code is sent by SMS or printed to stdout.
3. **Session.** The API returns a `accessToken` (HS256 JWT, 15 minutes) and an opaque `refreshToken` (7 days). `POST /api/auth/refresh` rotates the refresh token on every use. Reusing a rotated token revokes the whole session family. `POST /api/auth/logout` revokes the family. Failed logins and OTP attempts are rate limited and return `429` while locked.
4. **Connect ticket.** The portal calls `POST /api/vpn/ticket` with the access token. The API returns a one-time ticket that expires after 60 seconds.
5. **Loopback handoff.** The portal probes `GET http://127.0.0.1:47821/health` and `GET /status`. Both send the pairing token in the `X-Mango-Agent-Token` header. It then calls `POST /connect` with `{ "ticket": "..." }`.
6. **Key generation and registration.** The agent generates a fresh Curve25519 keypair in memory and calls `POST /api/vpn/connect` with the ticket, `publicKey`, `deviceFingerprint`, `hostname`, and `agentVersion`. The API:
   - checks that the agent version is allowed,
   - redeems the ticket once,
   - rejects revoked devices and fingerprints owned by another user,
   - allocates an address from `10.13.13.0/24` under a PostgreSQL advisory lock,
   - creates the session and sends the peer and its role policies to the daemon (`POST /peers`).
   If the daemon call fails, the session is marked disconnected and the API returns `502`.
7. **Tunnel activation.** The agent writes a WireGuard config for interface `mango0` and activates it: `wireguard.exe /installtunnelservice` on Windows, or `wg-quick up` on Linux. The portal then shows **Connected** with the assigned IP.
8. **Disconnect.** The agent calls `POST /disconnect`, which calls `POST /api/vpn/disconnect`. The API removes the peer from the daemon (`POST /peers/remove`) and marks the session disconnected.
9. **Real-time revocation.** Revoking a device (`POST /api/devices/:id/revoke`), disconnecting a session (`POST /api/sessions/:id/disconnect`), or deactivating a user (`PATCH /api/users/:id/status`) removes the affected peers from the daemon first. If the daemon call fails, the database is not updated.

---

## 6. Configuration

- **Backend and gateway:** copy `.env.example` to `.env` and replace every placeholder secret. The API validates its configuration at startup and refuses to start when a secret is missing or too short. See [QUICKSTART.md](QUICKSTART.md) for the variable reference.
- **Portal runtime config:** `Rain/portal/index.html` loads `/env-config.js` before the app. In Docker, `Rain/portal/docker-entrypoint.sh` writes that file from `VITE_API_URL` and `VITE_AGENT_URL` each time the container starts, so changing those values does not require a rebuild. `Rain/portal/src/lib/env.ts` uses `window.__MANGO_ENV__` first, then the build-time `VITE_*` values, then the defaults (`http://localhost:4000` for the API and `http://127.0.0.1:47821` for the agent).

---

## 7. Monorepo Scripts Reference

| Command | Action |
| :--- | :--- |
| `npm install` | Installs all workspaces (npm only) |
| `npm run build` | Builds `@mango/shared` first, then every workspace that has a `build` script |
| `npm test` | Runs the test script in every workspace (Vitest) |
| `npm run env:init` | Runs `scripts/init-env.mjs`: creates/updates root `.env` from `.env.example` with fresh secrets and an X25519 WireGuard keypair (cross-platform; `-- --force`, `-- --wg-only`, `-- --output <path>`) |
| `npm run dev:portal` | Starts the Vite dev server for `@mango/portal` (Admin UI on `:3000`) |
| `npm run dev:portal:admin` | Starts the Admin portal Vite dev server on `:3000` |
| `npm run dev:portal:staff` | Starts the Staff portal Vite dev server on `:3001` |
| `npm run dev:portal:client` | Starts the Client portal Vite dev server on `:3002` |
| `npm run dev:portal:all` | Runs `scripts/start-all-portals.mjs`: launches Admin `:3000`, Staff `:3001`, and Client `:3002` together with prefixed logs |
| `npm run dev:api` | Starts the Fastify API in watch mode (`@mango/api`, which mounts `@mango/rain-admin`) |
| `npm run mock:agent` | Runs the zero-dependency client agent simulator (mirrors `Sobree/agent-windows`) on `http://127.0.0.1:47821` |
| `npm run mock:daemon` | Runs the dev-only gateway daemon simulator (`scripts/mock-daemon.js`) on `http://127.0.0.1:50051`. Prints `[DEV MOCK DAEMON – no wg/nftables enforcement]`; it does not program WireGuard or `nftables` |
| `npm run db:start` | Starts embedded PostgreSQL 16 on `127.0.0.1:15432` (`scripts/dev-db.mjs`) without Docker, storing data in `.local/postgres` and creating `POSTGRES_DB` and `mangovpn_v2_test`. Ctrl+C stops it |
| `npm run db:reset-local` | Deletes `.local/postgres`. Run it only after `npm run db:start` has stopped |
| `npm run db:generate` | Generates `@prisma/client` from `Sobree/api/prisma/schema.prisma` |
| `npm run db:migrate` | Runs `prisma migrate dev` |
| `npm run db:seed` | Runs `Rain/admin/src/seed.ts` |
| `npm run check:env` | Runs `scripts/check-environment.mjs` (Linux, macOS, and Windows; `--role All` is the default) |
| `npm run check:env -- --role Rain` | Rain's Docker-free readiness check. Marks Docker, Docker Compose, and Go as `OPTIONAL` |
| `npm run check:env -- --role Sobree` | Full Sobree readiness. Exits `1` when Docker, Docker Compose, or Go is missing |
| `npm run docker:up` / `docker:down` / `docker:logs` | Starts, stops, or tails the Docker Compose stack (`postgres`, `vpn-gateway`, `api`, `portal`) |

Under `--role All`, missing Sobree tools only print `[PARTIAL]` and still exit `0`, so Rain-only machines and CI pass. Add `--strict` to fail in that case too. On Windows, `scripts/check-environment.ps1 -Role Rain` runs the same checker. Run `npm run check:env -- --help` for all options.

The guardrail scanner is not an npm script. Run it with `node scripts/check-guardrails.mjs`. CI runs it first.

---

## 8. Continuous Integration

`.github/workflows/ci.yml` runs on pushes and pull requests to `main` and `feature/**`. It runs the guardrail scanner, `npm ci`, the environment readiness check (`npm run check:env`), `npm run db:generate`, `npm run build`, and `npm test`. The Linux job vets, tests, and builds `Sobree/agent-windows` on Linux and cross-compiles it for Windows (`GOOS=windows`). It also vets and tests `Sobree/vpn-daemon`. A separate `windows-latest` job runs the agent's tests natively on Windows. `.github/CODEOWNERS` routes changes under `Sobree/`, `packages/shared/`, `docker-compose.yml`, `.github/`, `AGENTS.md`, and `scripts/check-guardrails.mjs` to `@SobreeH` for review.

---

## 9. End-to-End Walkthrough: Test, Run & Verify Locally

### Step 1 — Environment & Secrets (`.env`)

1. Verify local prerequisites. Rain's Docker-free workflow needs only `Node.js >= 18`, `npm >= 9`, and `Git >= 2.30` (run `npm run check:env -- --role Rain`). Sobree and the full Docker stack also need `Docker >= 24` (Docker Desktop on Windows, Docker Engine on Linux), `Docker Compose >= v2.20`, and `Go >= 1.22` / `1.26.0` for `agent-windows`. For real tunnels, Windows needs **WireGuard for Windows** (`wireguard.exe`), and Linux needs `wireguard-tools` (`wg`, `wg-quick`), `iproute2` (`ip`), and `nftables` (`nft`). Run `npm run check:env` to check everything:
   ```powershell
   npm run check:env
   ```
    ```bash
    npm run check:env                  # identical on Linux, macOS, and Windows
    npm run check:env -- --role Rain   # Docker-free Rain check
    ```
2. Create `.env` at the repository root. The cross-platform one-command path generates every secret and the WireGuard X25519 keypair:
   ```powershell
   npm run env:init
   ```
   ```bash
   npm run env:init                  # identical on Linux, macOS, and Windows
   ```
   `scripts/init-env.mjs` writes `.env` from `.env.example` with `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET`, `TOTP_ENCRYPTION_KEY`, `WG_PRIVATE_KEY`, and `WG_SERVER_PUBLIC_KEY`, as UTF-8 without a BOM. It leaves an existing populated `.env` untouched unless you pass `npm run env:init -- --force`; `npm run env:init -- --wg-only` refreshes only the WireGuard keys.

   Prefer to do it by hand? Copy the template and replace every placeholder secret:
   ```powershell
   copy .env.example .env
   openssl rand -base64 32   # distinct values for JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
   openssl rand -hex 32      # 64 hex chars for TOTP_ENCRYPTION_KEY
   ```
   ```bash
    cp .env.example .env
    openssl rand -base64 32   # distinct values for JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
    openssl rand -hex 32      # 64 hex chars for TOTP_ENCRYPTION_KEY
    ```
    Also configure `POSTGRES_PASSWORD`, `DATABASE_URL` (`postgresql://mango:<password>@localhost:15432/mangovpn?schema=public`), and WireGuard server keys (`WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`).

### Step 2 — Database Migration & Admin Seed

1. Start PostgreSQL 16 on host port `15432`. Pick one option:
   - **Rain, Docker-free:** keep this running in its own terminal:
     ```powershell
     npm run db:start
     ```
   - **Sobree / full stack (requires Docker Desktop):**
     ```powershell
     docker compose up -d postgres     # container mango-postgres
     ```
2. Generate the Prisma client and apply migrations (`npm run db:migrate`, or reset if upgrading from an older v1 schema):
   ```powershell
   npm run db:generate
   npm run db:migrate
   # If upgrading from a stale v1 DB:
   # npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
   ```
3. Seed roles (`ADMIN`, `STAFF`, `CLIENT`) and the initial admin user:
   ```powershell
   $env:SEED_ADMIN_USERNAME="admin"
   $env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
   $env:SEED_ADMIN_EMAIL="admin@mangovpn.local"   # optional
   npm run db:seed
   ```

Linux / macOS (Bash) equivalent of the seed step:

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<at-least-12-characters>"
export SEED_ADMIN_EMAIL="admin@mangovpn.local"   # optional
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

### Step 3 — Run Automated Verification Gates

```powershell
# 1. Security & anti-mock guardrails (must report 0 violations)
node scripts/check-guardrails.mjs

# 2. Full TypeScript monorepo build (@mango/shared -> admin -> portal -> api)
npm run build

# 3. Vitest suite (68 tests: 3 in @mango/rain-admin, 26 in @mango/portal, 39 in @mango/api)
$env:DATABASE_URL="postgresql://mango:<password>@localhost:15432/mangovpn?schema=public"
npm test

# 4. Go vet & unit tests for both Go modules
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

Linux / macOS (Bash) equivalent of the verification gates:

```bash
# 1. Security & anti-mock guardrails (must report 0 violations)
node scripts/check-guardrails.mjs

# 2. Full TypeScript monorepo build
npm run build

# 3. Vitest suite
export DATABASE_URL="postgresql://mango:<password>@localhost:15432/mangovpn?schema=public"
npm test

# 4. Go vet & unit tests (Linux, plus a Windows cross-compile check)
(cd Sobree/agent-windows && go vet ./... && go test ./... && GOOS=windows go vet ./... && cd ../..)
(cd Sobree/vpn-daemon && go vet ./... && go test ./... && cd ../..)
```

### Step 4 — Interactive Walkthrough (Browser -> API -> Agent -> Gateway)

- **Mode A — Portal & Admin Dev, Docker-free (Rain)**:
  1. Terminal 1: `npm run db:start` (embedded PostgreSQL 16 on `127.0.0.1:15432`; keep it running).
  2. Terminal 2: `npm run mock:daemon` (dev-only gateway simulator on `127.0.0.1:50051`; prints `[DEV MOCK DAEMON – no wg/nftables enforcement]`).
  3. Terminal 3: `npm run mock:agent` (binds `127.0.0.1:47821`, prints `PairingToken`).
  4. Terminal 4: `npm run dev:api` (Fastify API on `:4000`).
  5. Terminal 5: `npm run dev:portal` (starts Vite on `:3000` to match default `CORS_ORIGIN` and `AGENT_ALLOWED_ORIGINS`).

  No Docker is needed. Neither `mock:daemon` nor `mock:agent` activates WireGuard or `nftables` enforcement.
- **Mode B — Full Systems Dev with Go Windows Agent & Linux Gateway Container (Sobree, requires Docker Desktop)**:
  1. Start database and gateway (plus optional containerized API) — `docker-compose.yml` binds `vpn-gateway` `:50051` to host loopback `127.0.0.1:50051` so host-run `npm run dev:api` can reach it directly:
     ```powershell
     docker compose up -d postgres vpn-gateway
     npm run dev:api
     ```
  2. In an **Administrator** PowerShell (required for `wireguard.exe /installtunnelservice` on `mango0`), start `Sobree/agent-windows`:
     ```powershell
     $env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
     $env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
     $env:AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
     $env:API_URL="http://localhost:4000"
     cd Sobree/agent-windows; go run .
     ```
     *(Explicitly set `AGENT_PAIRING_TOKEN` because `main.go` generates an ephemeral token without printing its value when omitted.)*

      **Linux (Bash)**: the same agent runs on Linux as root (or with `CAP_NET_ADMIN`) with `wireguard-tools` installed. The agent writes `/tmp/mango-vpn/mango0.conf` (or `$TMPDIR/mango-vpn/mango0.conf`) and activates it with `wg-quick up`. `AGENT_PLATFORM` is optional and defaults to `linux-x64` on amd64:
      ```bash
      export AGENT_LISTEN_ADDR="127.0.0.1:47821"
      export AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
      export AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
      export API_URL="http://localhost:4000"
      cd Sobree/agent-windows && sudo -E go run .
      ```
- **In the browser (`http://localhost:3000`)**:
  1. **Password Login & TOTP Enrollment**: Sign in with the seeded `ADMIN` user -> scan the QR code (`MFA_SETUP_REQUIRED` -> `otpauthUri`) into an authenticator app -> submit the 6-digit code (`POST /api/auth/verify-otp`).
  2. **Pair Local Agent**: Paste the `PairingToken` into the Portal's agent token field (`X-Mango-Agent-Token`).
  3. **Connect VPN**: Click **Connect VPN** -> Portal requests a 60s single-use ticket (`POST /api/vpn/ticket`) -> agent generates an in-memory Curve25519 keypair and calls `POST /api/vpn/connect` -> API allocates `10.13.13.x` and registers the peer + role policies in `vpn-gateway` *(requires `vpn-gateway` reachable at `VPN_DAEMON_URL`, otherwise API returns `502`)* -> agent activates `mango0`.
  4. **Admin CRUD & Real-Time Revocation**: Manage **Users**, **Devices**, **Sessions**, **Policies**, **Audit Logs**, and **Agent Versions**. Revoking a device, disconnecting a session, or deactivating a user tears down the WireGuard peer on `vpn-gateway` first before committing the DB update.

---

## 10. Debugging & Troubleshooting Guide

| Issue / Symptom | Root Cause | Resolution |
| :--- | :--- | :--- |
| **API fails immediately on startup** | `Sobree/api/src/config.ts` validates required env vars at boot | Ensure `DATABASE_URL` is set, `JWT_SECRET`, `REFRESH_SECRET`, and `DAEMON_SHARED_SECRET` are `>= 32` chars, and `TOTP_ENCRYPTION_KEY` is `64` hex chars. |
| **Prisma errors (`type "public.RoleName" does not exist` or `table "public.connect_tickets" does not exist`)** | Target database still has legacy v1 tables/migrations | Run `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma` and `npm run db:seed`. |
| **`403 FORBIDDEN_ORIGIN` from Windows Agent / mock-agent** | Portal origin is outside `AGENT_ALLOWED_ORIGINS` (default `http://localhost:3000`–`http://localhost:3002`) | Run `npm run dev:portal` (Admin `:3000`) or `npm run dev:portal:all` (Admin `:3000`, Staff `:3001`, Client `:3002`), or add the origin to `AGENT_ALLOWED_ORIGINS` and `CORS_ORIGIN`. |
| **`401 Unauthorized` from `/status`, `/connect`, `/disconnect`** | Missing or mismatched `X-Mango-Agent-Token` header | Copy the `PairingToken` printed by `npm run mock:agent`, or set `$env:AGENT_PAIRING_TOKEN` (PowerShell) / `export AGENT_PAIRING_TOKEN=...` (Bash) explicitly before starting `Sobree/agent-windows`. |
| **`426` (`AGENT_VERSION_OUTDATED` / `AGENT_VERSION_INACTIVE`)** | `agent_versions` table blocks or requires a newer version for the agent's platform | Check or activate version `2.0.0` for the platform the running agent reports: `windows-x64` on Windows or `linux-x64` on Linux (see `AGENT_PLATFORM`) in the Portal's **Agent Versions** tab. |
| **`502 Bad Gateway` on Connect, Policy Sync, or Revocation** | `Sobree/api` cannot reach the gateway daemon at `VPN_DAEMON_URL`, or `DAEMON_SHARED_SECRET` mismatches | Docker-free: confirm `npm run mock:daemon` is running on `http://127.0.0.1:50051`. Docker: verify `vpn-gateway` is healthy (`docker compose ps vpn-gateway`), reachable at `http://vpn-gateway:50051` (inside Docker) or `http://127.0.0.1:50051` (host). In both cases `DAEMON_SHARED_SECRET` must match. |

**Useful live inspection commands**:
```powershell
# Check whether a port is in use (Windows)
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue

# Inspect WireGuard peers and nftables forward chain inside vpn-gateway
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn

# Inspect the local client agent / mock-agent loopback API and generated tunnel config (Windows)
Invoke-RestMethod http://127.0.0.1:47821/health
Invoke-RestMethod http://127.0.0.1:47821/status -Headers @{ "X-Mango-Agent-Token" = "<your-token>" }
Get-Content "$env:TEMP\mango-vpn\mango0.conf"
```
```bash
# Check whether a port is in use (Linux)
ss -tlnp | grep 4000

# Inspect WireGuard peers and nftables forward chain inside vpn-gateway (same commands on any host with Docker)
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn

# Inspect the local client agent / mock-agent loopback API and generated tunnel config (Linux)
curl -s http://127.0.0.1:47821/health
curl -s -H "X-Mango-Agent-Token: <your-token>" http://127.0.0.1:47821/status
cat /tmp/mango-vpn/mango0.conf
```

---

## 11. Shipping & Production Deployment Guide (Docker Compose & AWS + Windows Clients)

### 11.1 Pre-Ship Verification Status

All local dev, Docker build, and CI pipeline blockers have been resolved (`Rain/portal/nginx.conf`, LF `docker-entrypoint.sh`, Go `1.26` + `prisma migrate deploy` + `windows-agent-tests` in `.github/workflows/ci.yml`, loopback `:50051` binding in `docker-compose.yml`, Vite `:3000` default, and `AGENT_*` / `MANGO_AGENT_*` env aliases). Remaining pre-production hardening and live-cloud rollout tasks are tracked in GitHub Issues `#19`, `#20`, and `#21`.

### 11.2 Local Full-Stack Docker Compose Verification

```powershell
docker compose up -d --build
docker compose ps
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```
Linux / macOS (Bash) equivalent of the seed step:

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<at-least-12-characters>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

- `mango-api` runs `prisma migrate deploy` automatically before starting `Sobree/api/dist/server.js`.
- `mango-portal` runs `Rain/portal/docker-entrypoint.sh` at container startup to inject `VITE_API_URL` and `VITE_AGENT_URL` into `/usr/share/nginx/html/env-config.js` (`window.__MANGO_ENV__`).

### 11.3 Remote Linux Gateway & Control Plane Deployment (AWS EC2 — Profile B)

1. **Firewall / Security Group**: Allow **UDP `51820`** (WireGuard) and **HTTPS `443`** (reverse proxy / ALB terminating TLS and forwarding to Portal `:3000` and API `:4000`). Keep `vpn-gateway` (`:50051`) and `postgres` (`:5432`) private inside `mango-net`.
2. **Production `.env`**: Set `NODE_ENV=production`, strong random secrets, generated `WG_PRIVATE_KEY` + `WG_SERVER_PUBLIC_KEY`, `WG_SERVER_ENDPOINT=<AWS_PUBLIC_IP_OR_DNS>:51820`, `CORS_ORIGIN=https://vpn.example.com`, and `VITE_API_URL=https://api.vpn.example.com`.
3. **Deploy & seed**: Run `docker compose up -d --build` and run `npm run db:seed` for the initial `ADMIN` account.

### 11.4 Building, Registering & Rolling Out the Windows Service Agent (`Sobree/agent-windows`)

1. **Build the Windows executable and compute its SHA-256 checksum**:
   ```powershell
   cd Sobree/agent-windows
   $env:GOOS="windows"; $env:GOARCH="amd64"
   go build -trimpath -ldflags="-s -w" -o mango-agent-windows.exe .
   Get-FileHash .\mango-agent-windows.exe -Algorithm SHA256
   ```
Linux / macOS (Bash): build both release targets. The `linux-x64` binary is the Linux client agent, and the `windows-x64` binary is the Windows client agent:

```bash
cd Sobree/agent-windows
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o mango-agent-linux-x64 .
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o mango-agent-windows-x64.exe .
sha256sum mango-agent-linux-x64 mango-agent-windows-x64.exe
```

2. **Register in Admin Portal**: Add the release under **Agent Versions** (`version`: `2.0.0`, `platform`: `windows-x64` or `linux-x64`, `sha256Checksum`, `downloadUrl`, `isActive: true`).
3. **Install on client Windows VMs**: Ensure **WireGuard for Windows** is installed, install/start the service with `AGENT_LISTEN_ADDR=127.0.0.1:47821`, `AGENT_ALLOWED_ORIGINS=https://vpn.example.com`, `AGENT_PAIRING_TOKEN=<per-machine-token>`, and `API_URL=https://api.vpn.example.com`. On Linux clients, install `wireguard-tools`, `iproute2`, and `nftables` (`wg`, `wg-quick`, `ip`, `nft`), then run the agent as root or with `CAP_NET_ADMIN` (for example with a systemd unit that sets the same `AGENT_*` and `API_URL` variables). Real tunnel activation needs `wg-quick` on Linux or `wireguard.exe` on Windows.

### 11.5 Final Production Smoke & Zero-Trust Audit

- Verify login + TOTP enrollment + single-use Connect Ticket redemption (`POST /api/vpn/ticket` -> `POST /api/vpn/connect`).
- Verify `wg show` displays the peer and `nft list table inet mango_vpn` enforces the role's `ALLOW`/`DENY` rules with default drop.
- Verify real-time teardown by triggering Device Revoke, Session Disconnect, and User Deactivate from the Admin Console and confirming immediate peer removal on `wg0` and `mango0`.
