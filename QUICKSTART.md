# 🚀 MANGO VPN - Quick Start & Tool Readiness Guide

This guide lists the **tools, runtimes, and configuration** needed to run MANGO VPN v2 locally, and how to check that your machine is ready.

> [!TIP]
> **First time running or testing MANGO VPN?** Follow our beginner-friendly, step-by-step manual with automatic `.env` setup and click-by-click testing missions: **[🎓 English (`TUTORIAL.md`)](TUTORIAL.md)** | **[🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)](TUTORIAL.th.md)**.

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
| **Go Toolchain** | **Sobree** | `1.22.0` (daemon) / `1.26.0` (agent) | Latest | Client agent (`Sobree/agent-windows/go.mod` requires `go 1.26.0`; runs on Windows or Linux) and Linux VPN daemon (`Sobree/vpn-daemon/go.mod` requires `go 1.22`) | [go.dev](https://go.dev/dl/) |
| **WireGuard** | **Sobree** (real tunnels only) | Latest | Latest | Windows: **WireGuard for Windows**, where the agent runs `wireguard.exe /installtunnelservice`. Linux: `wireguard-tools` (`wg`, `wg-quick`), `iproute2` (`ip`), and `nftables` (`nft`). The agent uses them to bring up tunnel `mango0` | [wireguard.com](https://www.wireguard.com/install/) |
| **VS Code** *(Optional)* | **Both** | Latest | Latest | Editing | [code.visualstudio.com](https://code.visualstudio.com/) |

> [!NOTE]
> **Rain (Web Portal and Admin, Docker-free)**: You only need **Node.js and Git**, with **no Docker, Go, or WireGuard**, to run the portal, the API, and the admin CRUD. The Docker-free workflow uses three local tools: `npm run db:start` runs embedded PostgreSQL 16 (data in `.local/postgres`), `npm run mock:daemon` simulates the `:50051` gateway daemon (`[DEV MOCK DAEMON – no wg/nftables enforcement]`, dev-only), and `npm run mock:agent` simulates the `:47821` client agent (`scripts/mock-agent.js`, which mirrors `Sobree/agent-windows`). Full-stack Docker runs still use Docker Desktop if you want them.

---

## 2. Automated Readiness Check

```powershell
npm run check:env
```

This runs `scripts/check-environment.mjs` (Node.js only, no dependencies). It works the same on Linux, macOS, and Windows. It verifies tool availability on `PATH`, prints detected versions alongside the minimum requirements (Node.js, npm, Git, Docker, Docker Compose, and Go), checks the Docker daemon with `docker info`, and reports the WireGuard and gateway tools for your OS (`wireguard.exe` on Windows; `wg`, `wg-quick`, `ip`, and `nft` on Linux).

```powershell
npm run check:env
```

```bash
npm run check:env
```

For Rain's Docker-free setup, run the role-specific check instead. It marks Docker, Docker Compose, and Go as `OPTIONAL`:

```powershell
npm run check:env -- --role Rain
```

```bash
npm run check:env -- --role Rain
```

Options: `--role All|Rain|Sobree` (case-insensitive, default `All`), `--strict` (under `All`, also fail when Sobree tools are missing), and `--help`. The exit code is `0` when the required tools for the role are `READY`, `1` when one is missing, and `2` for invalid arguments. Under `All`, missing Sobree tools print `[PARTIAL]` and still exit `0`. On Windows, `scripts/check-environment.ps1 -Role Rain` runs the same checker.

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

On Linux, start the Docker Engine with `sudo systemctl start docker`. To run `docker` without `sudo`, add your user to the `docker` group (`sudo usermod -aG docker $USER`), then log out and back in.

```bash
docker -v
docker compose version
docker info
```

### Go Toolchain (Sobree)
```powershell
go version
```
- **If missing**: Install the Windows `.msi` from [go.dev/dl](https://go.dev/dl/). The agent module needs Go 1.26 or newer, so check the `go` line in `Sobree/agent-windows/go.mod` before you install.
- **If missing (Linux)**: Install Go 1.26 or newer from the tarball at [go.dev/dl](https://go.dev/dl/), or from your distribution's package if it is new enough. Confirm with `go version`.

```bash
go version
```

---

## 4. Environment Configuration (`.env`)

All backend and gateway settings come from a single `.env` file at the repository root. The template is [`.env.example`](.env.example).

### One-command setup (cross-platform)

```powershell
npm run env:init
```

```bash
npm run env:init
```

`npm run env:init` runs `scripts/init-env.mjs`, which works identically on Windows, Linux, and macOS. It creates `.env` from `.env.example` with fresh random secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET`, `TOTP_ENCRYPTION_KEY`) and a matching X25519 WireGuard server keypair (`WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`), written as UTF-8 without a BOM. It leaves an existing `.env` that already has its WireGuard keys populated unchanged unless you pass `npm run env:init -- --force`; `npm run env:init -- --wg-only` refreshes only the WireGuard keypair. It prints the generated server public key and reminds you never to commit the file.

### Manual setup

```powershell
copy .env.example .env
```

```bash
cp .env.example .env
```

Then replace every placeholder before you start anything:

| Variable | Used By | Notes |
| :--- | :--- | :--- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Docker Compose `postgres` **and** `npm run db:start` (embedded PostgreSQL 16, data in `.local/postgres`) | Host/loopback port defaults to `15432`. `npm run db:start` also creates `POSTGRES_DB` and `mangovpn_v2_test`. |
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
| **3000** | TCP (HTTP) | Web Portal (Admin, default) | Docker portal container and Vite dev server (`Rain/portal/vite.config.ts` pins port `3000`). `npm run dev:portal` and `npm run dev:portal:admin` serve the Admin portal here. |
| **3001** | TCP (HTTP) | Web Portal (Staff) | Started by `npm run dev:portal:staff` or by `npm run dev:portal:all`. |
| **3002** | TCP (HTTP) | Web Portal (Client) | Started by `npm run dev:portal:client` or by `npm run dev:portal:all`. |
| **4000** | TCP (HTTP) | Control Plane API (Fastify) | `PORT` |
| **15432** / **5432** | TCP (PostgreSQL) | PostgreSQL 16 on `127.0.0.1:15432` | Started by `npm run db:start` (embedded, Docker-free), or by the Docker `postgres` container (container port `5432`, host port `POSTGRES_PORT`, default `15432`). |
| **47821** | TCP (HTTP, loopback) | Client agent (`Sobree/agent-windows`) or `mock-agent.js` | Binds `127.0.0.1` only. |
| **51820** | UDP (WireGuard) | VPN gateway | `WG_LISTEN_PORT` |
| **50051** | TCP (HTTP) | VPN gateway daemon API | Bearer-authenticated HTTP on `127.0.0.1:50051`. Started by `npm run mock:daemon` (dev-only simulator, no `wg`/`nftables` enforcement) or by the Docker `vpn-gateway` service (bound to host loopback in `docker-compose.yml` for local host API dev). |

To check whether a port is in use on Windows:
```powershell
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
```

On Linux:
```bash
ss -tlnp | grep 4000
```

---

## 6. First-Time Setup

From the repository root:

```powershell
# 1. Install all workspaces (npm only)
npm install

# 2. Build shared contracts first, then every workspace that has a build script
npm run build

# 3. Create .env with fresh secrets and WireGuard keys (see section 4)
npm run env:init
```

On Linux or macOS (Bash), run the same steps unchanged. `npm run env:init` works on every platform; if you prefer the manual path, use `copy .env.example .env` on Windows or `cp .env.example .env` on Linux/macOS and fill in the placeholders yourself.

### Rain workflow (portal and admin, Docker-free)

Rain needs **no Docker**. Run these from the repository root, one block per terminal:

```powershell
# Terminal 1: embedded PostgreSQL 16 on 127.0.0.1:15432 (creates POSTGRES_DB and mangovpn_v2_test; data in .local/postgres)
npm run db:start                     # Ctrl+C stops it cleanly; run npm run db:reset-local only after it has stopped

# Setup terminal (while Terminal 1 keeps running)
npm run db:generate
npm run db:migrate
npm run db:seed                      # needs SEED_ADMIN_* variables

# Terminal 2: dev-only gateway daemon simulator on 127.0.0.1:50051 (no wg/nftables enforcement)
npm run mock:daemon

# Terminal 3: mock client agent (prints its PairingToken on startup)
npm run mock:agent

# Terminal 4: API on :4000
npm run dev:api

# Terminal 5: portal dev server. Pick one of the following:
npm run dev:portal                   # Admin UI on :3000 (default)
npm run dev:portal:all               # Admin :3000, Staff :3001, and Client :3002 together
npm run dev:demo                     # Shortcut: mock-agent + all 3 portals in one terminal (skip Terminal 3)
npm run dev:portal:admin             # Admin UI on :3000
npm run dev:portal:staff             # Staff UI on :3001
npm run dev:portal:client            # Client UI on :3002
```

These commands are plain `npm run` calls, so they work unchanged in Bash on Linux and macOS.

The API's default `CORS_ORIGIN` and the agent's default allowed origin are `http://localhost:3000`, and `Rain/portal/vite.config.ts` pins Vite to port `3000` automatically so `npm run dev:portal` works directly without extra flags. You can test all roles (`ADMIN`, `STAFF`, `CLIENT`) on this single `http://localhost:3000` URL: the portal sends `X-Mango-Dev-User` and `scripts/mock-agent.js` isolates agent session state and device fingerprints per username (`mock-<hash>-<username>`). In dev, `Sobree/api` also accepts `http://localhost:3000`–`http://localhost:3002` (and the `127.0.0.1` equivalents) if you use `dev:portal:all`. `npm run dev:api` and `npm run db:seed` also automatically fall back to loading the monorepo root `.env`.

Paste the PairingToken printed by the mock agent into the portal's pairing-token field. The portal sends it as the `X-Mango-Agent-Token` header.

### Sobree workflow (API, agent, and gateway; requires Docker Desktop)

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev:api

# Client agent on Windows (console mode, unless started by the Service Control Manager)
cd Sobree/agent-windows
go run .

# Gateway daemon. On Windows, run it in the container instead:
docker compose up -d vpn-gateway
```

```bash
docker compose up -d postgres
npm run db:generate
npm run db:migrate
npm run dev:api

# Client agent on Linux (root or CAP_NET_ADMIN, plus wg-quick)
cd Sobree/agent-windows
sudo -E go run .

# Gateway daemon on Linux (root or NET_ADMIN, plus ip, wg, and nft)
cd Sobree/vpn-daemon
sudo -E go run .
```

The `vpn-gateway` service needs `NET_ADMIN` and `wg`/`nft` on Linux. Run the daemon natively only on Linux.

### Full Docker stack

[`Rain/portal/nginx.conf`](Rain/portal/nginx.conf) serves the SPA on port `3000` with `Cache-Control: no-store` on `/env-config.js`. Build and start the full stack, verify container healthchecks, and seed the initial `ADMIN` user:

```powershell
docker compose up -d --build   # rebuild & start postgres, vpn-gateway, api, portal
docker compose ps              # verify all 4 services are healthy
npm run docker:logs

# Seed the database (reads DATABASE_URL from root .env automatically)
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<at-least-12-characters>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD

npm run docker:down
```

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<at-least-12-characters>"
npm run db:seed
unset SEED_ADMIN_PASSWORD

npm run docker:down
```

> [!NOTE]
> `docker-compose.yml` publishes `vpn-gateway` UDP `51820` externally and binds daemon HTTP `:50051` to host loopback `127.0.0.1:50051` (`VPN_DAEMON_URL=http://vpn-gateway:50051` inside `mango-net`, `http://127.0.0.1:50051` for host-run `npm run dev:api`).

---

## 7. Verify the Setup

```powershell
# 1. Security & anti-mock guardrails (must report 0 violations)
node scripts/check-guardrails.mjs

# 2. Full TypeScript monorepo build (@mango/shared first)
npm run build

# 3. Vitest suite (requires DATABASE_URL pointing at a v2-migrated PostgreSQL DB)
#    Docker-free: start `npm run db:start` first, then migrate the test DB and run the tests
$env:DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
Remove-Item Env:DATABASE_URL         # keep it unset so `npm run dev:api` uses the mangovpn DB from .env
```

```bash
export DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
npm test
unset DATABASE_URL                   # keep it unset so `npm run dev:api` uses the mangovpn DB from .env
```

Replace `<password>` with `POSTGRES_PASSWORD` from `.env`.

If your local `mangovpn` database still contains older v1 tables/migrations and tests fail with missing v2 types or tables (such as `type "public.RoleName" does not exist` or `table "public.connect_tickets" does not exist`), reset it to the v2 schema and re-seed:

```powershell
npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma
npm run db:seed
```

For Go changes, run the vet and tests in each module:
```powershell
cd Sobree/agent-windows; go vet ./...; go test ./...; cd ../..
cd Sobree/vpn-daemon; go vet ./...; go test ./...; cd ../..
```

```bash
(cd Sobree/agent-windows && go vet ./... && go test ./... && GOOS=windows go vet ./... && cd ../..)
(cd Sobree/vpn-daemon && go vet ./... && go test ./... && cd ../..)
```

---

## 8. Interactive Walkthrough (Login -> TOTP -> Connect -> Admin -> Revoke)

1. **Start services locally**:
   - **UI/Admin dev (Docker-free)**: Run `npm run db:start` (keep it running), `npm run mock:daemon`, `npm run mock:agent` (copy the printed `PairingToken`), `npm run dev:api`, and `npm run dev:portal` (or `npm --workspace=@mango/portal run dev -- --port 3000`).
   - **Real Windows tunnel dev**: Run `docker compose up -d postgres vpn-gateway api`, then in an **Administrator** PowerShell run `Sobree/agent-windows` with **WireGuard for Windows** installed:
     ```powershell
     $env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
     $env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
     $env:AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
     $env:API_URL="http://localhost:4000"
     cd Sobree/agent-windows; go run .
     ```
   Linux (Bash): run the agent as root (or with `CAP_NET_ADMIN`). It writes `/tmp/mango-vpn/mango0.conf` and runs `wg-quick up` on that file. Use the same `AGENT_*` and `API_URL` values:
   ```bash
   export AGENT_LISTEN_ADDR="127.0.0.1:47821"
   export AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
   export AGENT_PAIRING_TOKEN="<your-chosen-local-pairing-token>"
   export API_URL="http://localhost:4000"
   cd Sobree/agent-windows && sudo -E go run .
   ```
2. **Sign in (`http://localhost:3000`)**: Enter your seeded `ADMIN` username/password (`POST /api/auth/login`).
3. **Complete TOTP MFA**: On first login (`MFA_SETUP_REQUIRED`), scan the QR code (`otpauthUri`) in an authenticator app and enter the 6-digit code (`POST /api/auth/verify-otp`).
4. **Pair the local agent**: Paste the `PairingToken` into the Portal's pairing-token field (`X-Mango-Agent-Token`).
5. **Connect VPN**: Open **VPN Connect** in the sidebar and click **Connect VPN** -> Portal requests a 60s single-use ticket (`POST /api/vpn/ticket`) -> agent generates an in-memory Curve25519 keypair -> `POST /api/vpn/connect` allocates a `10.13.13.0/24` IP and programs `wg0` + `nftables` -> `AgentStatusCard` displays **Connected**. *(Note: `POST /api/vpn/connect` requires `vpn-gateway` reachable at `VPN_DAEMON_URL`, otherwise it marks the session disconnected and returns `502`.)*
6. **Test Admin Console & Real-Time Revocation**: Exercise **Users**, **Devices**, **Sessions** (including **Terminate All Active**), **Policies**, **Gateways**, **Audit Logs**, and **Agent Versions**, then trigger **Revoke Device** or **Disconnect Session** and confirm immediate peer removal. (In the `STAFF` portal, check **Help** to view/download active installers from `GET /api/vpn/agent-versions`.)

---

## 9. Debugging & Troubleshooting Cheat Sheet

| Symptom | Cause | Fix / Command |
| :--- | :--- | :--- |
| API refuses to start | Missing or short secret in `.env` (`Sobree/api/src/config.ts`) | Ensure `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET` are `>= 32` chars and `TOTP_ENCRYPTION_KEY` is `64` hex chars. |
| `RoleName` or `connect_tickets` does not exist | Local `mangovpn` DB still has v1 schema/migrations | Run `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma` and `npm run db:seed`. |
| `403 FORBIDDEN_ORIGIN` from agent | Portal running on an unexpected origin outside `AGENT_ALLOWED_ORIGINS` (default `http://localhost:3000`–`http://localhost:3002`) | Run `npm run dev:portal` (Admin `:3000`) or `npm run dev:portal:all` (Admin `:3000`, Staff `:3001`, Client `:3002`), or add the origin to `AGENT_ALLOWED_ORIGINS` and `CORS_ORIGIN`. |
| `401 Unauthorized` from agent | Missing/mismatched `X-Mango-Agent-Token` | Paste `PairingToken` from `npm run mock:agent`, or set `$env:AGENT_PAIRING_TOKEN` (PowerShell) / `export AGENT_PAIRING_TOKEN=...` (Bash) explicitly before `go run .` (Go agent does not print ephemeral tokens). |
| `426` (`AGENT_VERSION_OUTDATED` / `INACTIVE`) | Agent version blocked or outdated for its platform in `agent_versions` | Activate or update version `2.0.0` for the platform the running agent reports: `windows-x64` on Windows or `linux-x64` on Linux (see `AGENT_PLATFORM`) in the Portal's **Agent Versions** tab. |
| `502` on Connect / Policy Sync / Revoke | `api` cannot reach `vpn-gateway` or `DAEMON_SHARED_SECRET` mismatch | Docker-free (Track A): confirm `npm run mock:daemon` is running on `127.0.0.1:50051` and `DAEMON_SHARED_SECRET` is at least 32 characters. Docker: check `docker compose ps vpn-gateway`, `docker compose logs vpn-gateway`, and `VPN_DAEMON_URL`. |

**Quick live diagnostics** (PowerShell; Bash equivalents follow):
```powershell
# Inspect WireGuard peers and nftables policy chain inside vpn-gateway
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn

# Probe local Windows Agent / mock-agent loopback endpoints
Invoke-RestMethod http://127.0.0.1:47821/health
Invoke-RestMethod http://127.0.0.1:47821/status -Headers @{ "X-Mango-Agent-Token" = "<your-token>" }
Get-Content "$env:TEMP\mango-vpn\mango0.conf"
```

```bash
# Same checks on Linux
ss -tlnp | grep 4000
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
curl -s http://127.0.0.1:47821/health
curl -s -H "X-Mango-Agent-Token: <your-token>" http://127.0.0.1:47821/status
cat /tmp/mango-vpn/mango0.conf
```

---

## 10. Pre-Ship & Cloud Deployment Checklist

1. **Pre-ship repo readiness**:
   - Local dev/Docker/CI blockers (`Rain/portal/nginx.conf`, LF `docker-entrypoint.sh`, Go `1.26` + `prisma migrate deploy` + `windows-agent-tests` in `.github/workflows/ci.yml`, and `AGENT_*` / `MANGO_AGENT_*` env aliases) are resolved. Remaining hardening/rollout tickets are tracked in GitHub Issues `#19`, `#20`, and `#21`.
2. **Deploy Linux gateway & control plane (AWS EC2 — Profile B in `.env.example`)**:
   - Open **UDP `51820`** (WireGuard) and **HTTPS `443`** (reverse proxy/ALB -> Portal `:3000` and API `:4000`); block `15432` in the EC2 Security Group (`:50051` is bound to `127.0.0.1` on the host and internal to `mango-net`).
   - Set `NODE_ENV=production`, strong secrets, `WG_SERVER_ENDPOINT=<AWS_PUBLIC_IP_OR_DNS>:51820`, `CORS_ORIGIN=https://vpn.example.com`, and `VITE_API_URL=https://api.vpn.example.com`, then run `docker compose up -d --build` and `npm run db:seed`.
3. **Build & roll out the client agent (`Sobree/agent-windows`, Windows or Linux)**:
   - Build binary (`$env:GOOS="windows"; $env:GOARCH="amd64"; go build -trimpath -ldflags="-s -w" -o mango-agent-windows.exe .`) and record SHA-256 (`Get-FileHash`).
   - Linux / macOS (Bash): `GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o mango-agent-linux-x64 .` and `GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o mango-agent-windows-x64.exe .`, then `sha256sum` each file.
   - Register each release in Admin **Agent Versions** (`platform`: `windows-x64` or `linux-x64`) and configure client env vars (`AGENT_LISTEN_ADDR`, `AGENT_ALLOWED_ORIGINS`, `AGENT_PAIRING_TOKEN`, `API_URL`).
