# 🚀 MANGO VPN - Quick Start & Tool Readiness Guide

This guide lists the **tools, runtimes, and configuration** needed to run MANGO VPN v2 locally, and how to check that your machine is ready.

> [!IMPORTANT]
> **Using an AI Assistant?** Instruct your AI to read [`AGENTS.md`](AGENTS.md) before starting any task. It defines project scope, cross-boundary collaboration rules (`Rain/`, `Sobree/`, `packages/shared/`), and the anti-mock guardrails.

---

## 1. Tool Matrix

| Tool / Program | Required For | Min Version | Recommended | Purpose in MANGO VPN | Official Download |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | **Both** (Rain & Sobree) | `18.0.0` | `20 LTS` or `22 LTS` | Control Plane API, Web Portal (React 18 + Vite), shared contracts, TypeScript compiler | [nodejs.org](https://nodejs.org/) |
| **npm** | **Both** (Rain & Sobree) | `9.0.0` | `10.x` | Monorepo workspaces (`Rain/*`, `Sobree/*`, `packages/*`). npm only; there is no pnpm workspace. | Bundled with Node |
| **Git** | **Both** (Rain & Sobree) | `2.30.0` | Latest | Version control and branching | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | **Sobree** (and Rain for full-stack runs) | `24.0.0` | Latest | PostgreSQL 16 container, Linux WireGuard gateway container (`NET_ADMIN`) | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Go Toolchain** | **Sobree** | `1.22.0` (daemon) / `1.26.0` (agent) | Latest | Windows Agent (`Sobree/agent-windows/go.mod` requires `go 1.26.0`) and Linux VPN daemon (`Sobree/vpn-daemon/go.mod` requires `go 1.22`) | [go.dev](https://go.dev/dl/) |
| **WireGuard for Windows** | **Sobree** | Latest | Latest | The agent runs `wireguard.exe /installtunnelservice` to bring up tunnel `mango0` | [wireguard.com](https://www.wireguard.com/install/) |
| **VS Code** *(Optional)* | **Both** | Latest | Latest | Editing | [code.visualstudio.com](https://code.visualstudio.com/) |

> [!NOTE]
> **Rain (Web Portal and Admin)**: You only need **Node.js and Git** to run the portal, the API, and the admin CRUD. Use the Node loopback simulator `scripts/mock-agent.js` in place of the Windows Agent, so Go, Docker, and WireGuard are not required for UI work. PostgreSQL is still required, so start it with Docker or point `DATABASE_URL` at your own instance.

---

## 2. Automated Readiness Check

```powershell
npm run check:env
```

This runs `scripts/check-environment.ps1`, which reports whether Node.js, npm, Git, Docker, Docker Compose, and Go are installed and meet their minimum versions.

---

## 3. Manual CLI Checks

### Node.js and npm
```powershell
node -v
npm -v
```
- **Expected**: `v18.x`, `v20.x`, or `v22.x`, and npm `9.x` or newer.
- **If missing**: Install the **LTS** release from [nodejs.org](https://nodejs.org/) and keep **"Add to PATH"** checked.

### Git
```powershell
git --version
```

### Docker and Docker Compose (Sobree)
```powershell
docker -v
docker compose version
docker info
```
If `docker info` reports `error during connect`, start **Docker Desktop** and wait until the engine is running.

### Go Toolchain (Sobree)
```powershell
go version
```
- **If missing**: Install the Windows `.msi` from [go.dev/dl](https://go.dev/dl/). The agent module needs Go 1.26 or newer, so check the `go` line in `Sobree/agent-windows/go.mod` before you install.

---

## 4. Environment Configuration (`.env`)

All backend and gateway settings come from a single `.env` file at the repository root. The template is [`.env.example`](.env.example).

```powershell
copy .env.example .env
```

Then replace every placeholder before you start anything:

| Variable | Used By | Notes |
| :--- | :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Docker Compose `postgres` | Host port defaults to `15432`. |
| `DATABASE_URL` | API and Prisma CLI on the host | Must point at the same database and port. |
| `JWT_SECRET`, `REFRESH_SECRET` | API | Required, at least 32 characters. The API refuses to start if they are missing or too short. |
| `TOTP_ENCRYPTION_KEY` | API | Required, exactly 64 hex characters. |
| `DAEMON_SHARED_SECRET` | API and VPN daemon | Required, at least 32 characters. The API sends it as a Bearer token. |
| `PORT` / `API_PORT` | API | Defaults to `4000`. |
| `CORS_ORIGIN` | API | Defaults to `http://localhost:3000`. |
| `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`, `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`, `WG_DNS`, `WG_SERVER_ENDPOINT` | VPN gateway | `WG_SERVER_ENDPOINT` is the address clients dial (for example `127.0.0.1:51820` locally). |
| `VITE_API_URL`, `VITE_AGENT_URL` | Portal | Used by the Docker entrypoint and the Vite build. See below. |
| `PORTAL_PORT` | Portal container | Defaults to `3000`. |

Generate secrets with:
```powershell
openssl rand -base64 32   # JWT_SECRET, REFRESH_SECRET, DAEMON_SHARED_SECRET
openssl rand -hex 32      # TOTP_ENCRYPTION_KEY (64 hex characters)
```

### Portal runtime configuration

The portal reads its API and agent URLs at runtime from `window.__MANGO_ENV__`:
- `Rain/portal/index.html` loads `/env-config.js` before the app bundle.
- Local Vite dev uses the placeholder [`Rain/portal/public/env-config.js`](Rain/portal/public/env-config.js).
- In a container, [`Rain/portal/docker-entrypoint.sh`](Rain/portal/docker-entrypoint.sh) overwrites `/usr/share/nginx/html/env-config.js` from `VITE_API_URL` and `VITE_AGENT_URL` at each start. Changing those values does not need a rebuild.

### Seed the first admin

The seed script creates the first ADMIN user. It needs these variables in the environment (not in `.env.example`):
- `SEED_ADMIN_USERNAME`
- `SEED_ADMIN_PASSWORD` (at least 12 characters)
- `SEED_ADMIN_EMAIL` (optional)

Do not put a default password in source or in `.env.example`.

---

## 5. Port Map

| Port | Protocol | Component | Notes |
| :--- | :--- | :--- | :--- |
| **3000** | TCP (HTTP) | Web Portal | Docker portal container. For local Vite dev, use `--port 3000` (see below). |
| **4000** | TCP (HTTP) | Control Plane API (Fastify) | `PORT` |
| **5432** | TCP (PostgreSQL) | PostgreSQL 16 inside Docker | Container port. Host port is `POSTGRES_PORT` (default `15432`). |
| **47821** | TCP (HTTP, loopback) | Windows Agent or `mock-agent.js` | Binds `127.0.0.1` only. |
| **51820** | UDP (WireGuard) | VPN gateway | `WG_LISTEN_PORT` |
| **50051** | TCP (HTTP) | VPN gateway daemon API | Bearer-authenticated HTTP, not a Unix socket. |

To check whether a port is in use on Windows:
```powershell
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
```

---

## 6. First-Time Setup

From the repository root:

```powershell
# 1. Install all workspaces (npm only)
npm install

# 2. Build shared contracts first, then every workspace that has a build script
npm run build

# 3. Create .env from the template and fill in secrets (see section 4)
copy .env.example .env
```

### Rain workflow (portal and admin)

```powershell
docker compose up -d postgres        # database on host port 15432
npm run db:generate
npm run db:migrate
npm run db:seed                      # needs SEED_ADMIN_* variables
npm run mock:agent                   # Terminal 1: prints its PairingToken on startup
npm run dev:api                      # Terminal 2: API on :4000
npm run dev:portal                   # Terminal 3: portal dev server
```

The API's default `CORS_ORIGIN` and the agent's default allowed origin are `http://localhost:3000`. Vite's own default is `5173`, so start the dev server on port 3000:

```powershell
npm --workspace=@mango/portal run dev -- --port 3000
```

Paste the PairingToken printed by the mock agent into the portal's pairing-token field. The portal sends it as the `X-Mango-Agent-Token` header.

### Sobree workflow (API, agent, and gateway)

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev:api

# Windows Agent (console mode, unless started by the Service Control Manager)
cd Sobree/agent-windows
go run .

# Gateway daemon. On Windows, run it in the container instead:
docker compose up -d vpn-gateway
```

The `vpn-gateway` service needs `NET_ADMIN` and `wg`/`nft` on Linux. Run the daemon natively only on Linux.

### Full Docker stack

```powershell
npm run docker:up        # postgres, vpn-gateway, api, portal
npm run docker:logs
npm run docker:down
```

> [!WARNING]
> `Rain/portal/Dockerfile` copies `Rain/portal/nginx.conf`, but that file is not in the repository yet. The portal image will not build until it is added. Track this before you rely on the `portal` service.

---

## 7. Verify the Setup

```powershell
npm run build
npm test
node scripts/check-guardrails.mjs
```

For Go changes, run the vet and tests in each module:
```powershell
cd Sobree/agent-windows; go vet ./...; go test ./...
cd ../vpn-daemon; go vet ./...; go test ./...
```
