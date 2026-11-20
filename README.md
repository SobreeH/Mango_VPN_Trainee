# MANGO VPN

> A Zero-Trust Role-Based WireGuard Remote Access & Policy Management System.

MANGO VPN removes manual `.conf` file handling for corporate VPN users. Users sign in to a web portal with a password and an authenticator-app (TOTP) code. The control plane API issues a one-time connect ticket, and a local Windows Agent generates a Curve25519 keypair in memory, registers it with the API, and brings up the WireGuard tunnel. A Linux gateway daemon programs WireGuard peers and role-based `nftables` policies. Admins manage users, devices, sessions, policies, audit logs, and agent versions from the portal.

---

## 📚 Documentation

- **[🤖 AI Development & Project Scoping Guide (`AGENTS.md`)](AGENTS.md)**: **Mandatory reading for all AI coding assistants**: scope rules, cross-boundary collaboration, protected paths, and anti-hallucination guardrails.
- **[🚀 Quick Start & Environment Readiness Guide (`QUICKSTART.md`)](QUICKSTART.md)**: Tool prerequisites, `.env` setup, port map, and first-time setup.

---

## 0. Stack (v2)

| Area | Technology (from the `package.json` and `go.mod` files) |
| :--- | :--- |
| Monorepo | npm workspaces (`Rain/*`, `Sobree/*`, `packages/*`). npm only; there is no pnpm workspace. |
| Web portal (`@mango/portal` 0.2.0) | React 18.3, Vite 5, Tailwind CSS 3, TanStack Query 5, Zod 4 |
| Control plane API (`@mango/api` 0.2.0) | Node.js >= 18, Fastify 4, Prisma 5, bcryptjs, jsonwebtoken |
| Database | PostgreSQL 16 (`postgres:16-alpine` in Docker Compose) |
| Windows Agent | Go 1.26 (`Sobree/agent-windows/go.mod`), `golang.org/x/sys/windows/svc` |
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
│   │   ├── src/api/agent.ts           # Windows Agent loopback client (/health, /status, /connect, /disconnect)
│   │   ├── src/components/            # AgentStatusCard and admin tabs (users, devices, sessions, policies, audit logs, agent versions)
│   │   ├── src/lib/env.ts             # API and agent base URL resolution
│   │   ├── public/env-config.js       # Dev placeholder for window.__MANGO_ENV__
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
│   ├── agent-windows/                 # Go Windows Agent (Windows Service or console), 127.0.0.1:47821
│   │   ├── main.go                    # Loopback API, Origin allowlist, PNA headers, X25519 keygen, WireGuard activation
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
│   ├── mock-agent.js                  # 🧪 Node loopback simulator of the Windows Agent (127.0.0.1:47821)
│   ├── check-guardrails.mjs           # Scanner for hardcoded secret fallbacks, MOCK_* data, wildcard agent CORS, SYS_MODULE
│   └── check-environment.ps1          # Tool readiness check (npm run check:env)
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
| **Windows Agent** | Uses `scripts/mock-agent.js` for UI testing | `Sobree/agent-windows` (Go Windows Service) |
| **VPN gateway** | N/A | `Sobree/vpn-daemon` (Linux `wg` + `nftables`) |
| **Shared contracts** | Consumes `@mango/shared` | Defines `@mango/shared` |

---

## 3. Workflow for Rain

Rain works inside `Rain/` and only reads Sobree's API. The API still needs PostgreSQL and a configured `.env` (see [QUICKSTART.md](QUICKSTART.md)).

```powershell
# 1. Local Windows Agent simulator (terminal 1). It prints its PairingToken at startup.
npm run mock:agent

# 2. Management API (terminal 2)
npm run dev:api

# 3. Portal UI (terminal 3)
npm run dev:portal
```

- **Portal UI**: Vite's default address is `http://localhost:5173`. The API's `CORS_ORIGIN` and the agent's `AGENT_ALLOWED_ORIGINS` default to `http://localhost:3000`. To match those defaults, run `npm --workspace=@mango/portal run dev -- --port 3000`.
- **Agent pairing**: Paste the mock agent's PairingToken into the portal's "Paste X-Mango-Agent-Token" field.
- **Admin CRUD**: Edit the modules in `Rain/admin/src/` (`index.ts` mounts them).
- **Seed the database**: Run `npm run db:seed`. It needs `SEED_ADMIN_USERNAME` and `SEED_ADMIN_PASSWORD` (at least 12 characters) in the environment.

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

# Windows Agent: runs as a console server unless started by the Service Control Manager
cd Sobree/agent-windows
go run .

# Linux VPN daemon (Linux only; needs root or NET_ADMIN, plus ip, wg, and nft).
# On Windows, use the vpn-gateway container: docker compose up -d vpn-gateway
cd Sobree/vpn-daemon
go run .
```

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
7. **Tunnel activation.** The agent writes a WireGuard config and runs `wireguard.exe /installtunnelservice` on interface `mango0`. The portal then shows **Connected** with the assigned IP.
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
| `npm run dev:portal` | Starts the Vite dev server for `@mango/portal` |
| `npm run dev:api` | Starts the Fastify API in watch mode (`@mango/api`, which mounts `@mango/rain-admin`) |
| `npm run mock:agent` | Runs the zero-dependency Windows Agent simulator on `http://127.0.0.1:47821` |
| `npm run db:generate` | Generates `@prisma/client` from `Sobree/api/prisma/schema.prisma` |
| `npm run db:migrate` | Runs `prisma migrate dev` |
| `npm run db:seed` | Runs `Rain/admin/src/seed.ts` |
| `npm run check:env` | Runs `scripts/check-environment.ps1` |
| `npm run docker:up` / `docker:down` / `docker:logs` | Starts, stops, or tails the Docker Compose stack (`postgres`, `vpn-gateway`, `api`, `portal`) |

The guardrail scanner is not an npm script. Run it with `node scripts/check-guardrails.mjs`. CI runs it first.

---

## 8. Continuous Integration

`.github/workflows/ci.yml` runs on pushes and pull requests to `main` and `feature/**`. It runs the guardrail scanner, `npm ci`, `npm run db:generate`, `npm run build`, `npm test`, and `go vet`, `go build`, and `go test` for the Go modules. `.github/CODEOWNERS` routes changes under `Sobree/`, `packages/shared/`, `docker-compose.yml`, `.github/`, `AGENTS.md`, and `scripts/check-guardrails.mjs` to `@SobreeH` for review.
