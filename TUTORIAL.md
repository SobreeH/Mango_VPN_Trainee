> 🌐 **Language / ภาษา**: **English (`TUTORIAL.md`)** | [🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)](TUTORIAL.th.md)

# MANGO VPN v2: Your First-Time Windows & Linux Tutorial

Welcome! This guide walks you from a fresh setup to a working MANGO VPN v2 demo on **Windows (PowerShell)** or **Linux (Bash)**. You do not need to know Docker, Prisma, or WireGuard beforehand. Follow one step at a time, and use the **What you should see** notes to check your progress.

> **How to read the commands:** Each step that needs a shell shows a **Windows (PowerShell)** block and a **Linux / macOS (Bash)** block. Use the one for your OS. Commands without a platform label (such as `npm run ...`) are identical on both.

> **Safety note:** This is a local development/demo setup, not a production deployment. Keep your `.env` file private, and do not reuse its generated secrets elsewhere.

## Welcome & The 60-Second Big Picture

MANGO VPN lets a user sign in with a password and a time-based one-time password (TOTP) from an authenticator app. There are no manually downloaded VPN `.conf` files in the user workflow. After sign-in, the portal gets a **single-use connect ticket that expires after 60 seconds**. A local **client agent** runs on your own machine (Windows or Linux) at `127.0.0.1:47821`. It generates a fresh Curve25519 keypair in memory, sends its public key to the Control Plane API, and activates WireGuard on your machine. The gateway installs that peer and enforces the user's role policies with `nftables`.

The client agent comes in two forms:

- **`Sobree/agent-windows`** (Go): the real agent. On **Windows** it runs `wireguard.exe /installtunnelservice`. On **Linux** it runs `wg-quick up`.
- **`scripts/mock-agent.js`** (Node.js): a simulator of the same loopback contract for UI work. It does not install a tunnel on either OS.

### The five components

```mermaid
flowchart LR
    Browser["Web Portal (localhost:3000)"] -->|HTTP API| API["Control Plane API (localhost:4000)"]
    API -->|SQL| DB[("PostgreSQL 16 (localhost:15432)")]
    Browser -->|Loopback + pairing token| Agent["Local Client Agent (127.0.0.1:47821 - mock or Go; Windows or Linux host)"]
    Agent -->|Ticket redemption + public key| API
    API -->|Bearer-authenticated HTTP| Gateway["Linux VPN Gateway Daemon (127.0.0.1:50051)"]
    Agent -->|WireGuard UDP| WG["WireGuard gateway (51820/udp mango-vpn-gateway)"]
    Gateway -->|wg + nftables| WG
```

| Component | Local address / port | What it does |
|---|---|---|
| Web Portal | `http://localhost:3000` (`:3001` Staff, `:3002` Client with `dev:portal:all`) | Login, TOTP enrollment, VPN controls, and Admin Governance UI. |
| Control Plane API | `http://localhost:4000` | Password/TOTP auth, short-lived connect tickets, IP allocation, and gateway coordination. |
| PostgreSQL 16 | `localhost:15432` (container port `5432`) | Stores users, sessions, policies, devices, and audit history. Track A runs it embedded with `npm run db:start` (data in `.local/postgres`); Tracks B/C run the Docker container `mango-postgres`. |
| Local Client Agent | `http://127.0.0.1:47821` | `scripts/mock-agent.js` for UI demos (Windows or Linux), or the Go `Sobree/agent-windows` for a real WireGuard tunnel (`wireguard.exe` on Windows, `wg-quick` on Linux). |
| Linux VPN Gateway Daemon | `http://127.0.0.1:50051` (HTTP); `51820/udp` (WireGuard) | Programs `wg0` and role-based `nftables` rules. Track A simulates it with `npm run mock:daemon` (`scripts/mock-daemon.js`, dev-only, no `wg`/`nftables` enforcement). Tracks B/C run the Docker service `mango-vpn-gateway`; Linux users may instead run `Sobree/vpn-daemon` natively. |

### Which Track Should I Use?

| Track | Choose this if… | What it proves | What you need |
|---|---|---|---|
| **Track A (Rain — UI & Admin Dev, Docker-free)** | You are learning the portal and Admin CRUD, or do not want to configure a real tunnel yet. | Login/MFA, API, Admin CRUD, gateway peer/policy requests, and simulated agent UI state. Neither `mock:daemon` nor `mock:agent` activates a real WireGuard tunnel or `nftables` enforcement. | Node.js, Git, and an authenticator app. **No Docker required.** Works on Windows and Linux. Uses `npm run db:start`, `npm run mock:daemon`, and `npm run mock:agent`. |
| **Track B (Sobree — Full Go Agent & Real WireGuard Tunnel)** | You want the real Go agent to bring up a WireGuard tunnel. | Real ticket flow, agent key generation, real tunnel activation, and Docker Linux gateway peer/policy programming. | **Windows:** Node.js, Git, Docker Desktop (for `postgres` + `vpn-gateway`), Go 1.26+, WireGuard for Windows, and an Administrator PowerShell. **Linux:** Node.js, Git, Docker Engine with Compose v2 (for `postgres` + `vpn-gateway`, or native `Sobree/vpn-daemon`), Go 1.26+, `wireguard-tools`, `iproute2`, `nftables`, and root (`sudo`). |
| **Track C (One-Command Full Docker Stack Demo)** | You want the API, portal, database, and gateway containers started together. | The four-container stack and a client agent on your host connected to it. | **Windows:** Node.js, Git, Docker Desktop. **Linux:** Node.js, Git, Docker Engine with Compose v2. On both, you also need an authenticator app. Run `mock-agent.js` or the Go agent **on your host** (not in Docker), because a browser inside Docker cannot reach its host's loopback agent. |

## Phase 1: Check Your Computer Is Ready (5 Minutes)

### 1.1 Install the tools for your track

| Tool | Rain / Track A | Sobree / Track B | Why it is needed |
|---|---:|---:|---|
| Node.js `>=18` (recommended: `20 LTS`) | Required | Required | Runs the API, portal, build, mock simulators, and tests. |
| npm `>=9` | Required | Required | Installs the monorepo workspaces. npm comes with Node.js. |
| Git `>=2.30` | Required | Required | Gets and manages the project files. |
| Docker: **Docker Desktop** (Windows) or **Docker Engine + Compose v2 plugin** (Linux) | Not needed (uses `npm run db:start` & `npm run mock:daemon`) | Required | Runs PostgreSQL and the Linux gateway for Track B/C. |
| Go `>=1.26` (client agent `Sobree/agent-windows`) / `1.22` (`Sobree/vpn-daemon`) | Not needed for mock agent | Required for the Go agent | The Go agent module requires Go 1.26. The Linux daemon module lists Go 1.22. |
| WireGuard: **WireGuard for Windows** (`wireguard.exe`) on Windows; **`wireguard-tools`** (`wg`, `wg-quick`), **`iproute2`**, and **`nftables`** (`nft`) on Linux | Not needed for mock agent | Required for real tunnel | Provides the tunnel commands the Go agent uses to bring up `mango0`. |

Linux package example (Debian/Ubuntu; use your distribution's equivalents):

```bash
sudo apt update
sudo apt install -y wireguard-tools iproute2 nftables openssl
```

Track A (Rain) needs **zero Docker**. `npm run db:start` runs embedded PostgreSQL 16, and `npm run mock:daemon` simulates the gateway daemon API on `127.0.0.1:50051`, so policy and revocation calls have an endpoint to reach. This simulator is dev-only and does not program WireGuard or `nftables`. Tracks B and C use Docker for the real gateway.

### 1.2 Run the project readiness check

Open **PowerShell** (Windows) or a **terminal** (Linux/macOS) and change to the repository folder. Replace the path with wherever you cloned the project:

**Windows (PowerShell):**

```powershell
cd <path-to>\Mango_VPN_Trainee
```

**Linux / macOS (Bash):**

```bash
cd <path-to>/Mango_VPN_Trainee
```

Then run the same command on either OS:

```bash
npm run check:env
```

Rain (Track A, Docker-free) should run the role-specific check instead. It marks Docker CLI, Docker Compose, Docker Desktop/Engine, and Go as `OPTIONAL`:

```bash
npm run check:env -- --role Rain
```

On Windows, `npm run check:env -- -Role Rain` also works, and the PowerShell script `scripts/check-environment.ps1` accepts `-Role Rain` as well.

**What you should see:** A table with tool status and versions, followed by a readiness summary if Node.js, npm, and Git are available. On Linux the script also checks `wg`, `wg-quick`, `ip`, and `nft`; on Windows it checks `wireguard.exe`. The script detects whether commands are on `PATH`; it does not install tools or check WireGuard's configuration. For Track B, separately run:

```bash
go version
```

**What you should see:** A Go version of `go1.26` or newer for the client agent. If your shell says a command is not recognized, install that tool and open a new terminal so the updated `PATH` is loaded.

### 1.3 Check Docker is actually running (Track B and Track C only)

Track A (Rain) can skip this section and go directly to Phase 2. The `docker info` check is only needed for Track B and Track C.

- **Windows:** Open **Docker Desktop** and wait until the bottom-left status bar says **Engine running**.
- **Linux (Docker Engine):** Start the service if it is not running, then add your user to the `docker` group if `docker info` reports a permission error (log out and back in afterwards):

  ```bash
  sudo systemctl start docker
  sudo usermod -aG docker "$USER"
  ```

Then run the same check on either OS:

```bash
docker info
```

**What you should see:** A long report with both **Client** and **Server** information. If you see `error during connect` (Windows) or `Cannot connect to the Docker daemon` (Linux), the Docker engine is not running yet. A Docker command-line program alone is not enough; the Docker engine must be running.

## Phase 2: First-Time Install & `.env` Setup (3 Minutes)

Do these steps from the repository root in your terminal.

### Step 2.1: Install and build

```bash
npm install
npm run build
```

`npm install` installs dependencies for every npm workspace. `npm run build` builds `@mango/shared` first automatically, then builds the other workspaces that have build scripts.

**What you should see:** `npm install` completes without an `npm ERR!` failure. The build ends with successful workspace build output and no TypeScript errors. Warnings are not necessarily failures; an error and non-zero exit code are.

### Step 2.2: Create `.env` and generate strong secrets

The API and Docker Compose need a root `.env` file. Run the cross-platform initializer from the repository root — it works identically on **Windows (PowerShell)** and **Linux / macOS (Bash)** with zero extra tools:

```bash
npm run env:init
```

`scripts/init-env.mjs` starts from `.env.example` and writes `.env` (UTF-8 **without a BOM**) containing:

- a URL-safe random `POSTGRES_PASSWORD`, with the same password written into `DATABASE_URL`;
- independent 32-byte Base64 values for `JWT_SECRET`, `REFRESH_SECRET`, and `DAEMON_SHARED_SECRET`;
- a 64-hex-character `TOTP_ENCRYPTION_KEY` (32 bytes);
- a Curve25519 WireGuard keypair for `WG_PRIVATE_KEY` and `WG_SERVER_PUBLIC_KEY`.

**It safely skips overwriting existing secrets if `.env` already exists** (and fills in blank `WG_PRIVATE_KEY` / `WG_SERVER_PUBLIC_KEY` if missing). Pass `npm run env:init -- --force` only if you want to regenerate everything, or `npm run env:init -- --wg-only` to rotate just the WireGuard keys.

**What you should see:** On a new setup, `Created .env with fresh random secrets and WireGuard keypair (UTF-8 without BOM). Server Public Key: ...`. If `.env` already existed with all values populated, it reports leaving the file unchanged. Do not paste secret values into chat or commit `.env`.

<details>
<summary>Alternative: shell-only / manual generation (PowerShell &amp; Bash) — optional</summary>

If you prefer generating `.env` directly in your shell instead of `npm run env:init`, paste the block for your OS from the repository root:

**Windows (PowerShell):** Uses the .NET cryptographic random-number generator built into Windows and writes UTF-8 **without a BOM**. It needs no `openssl`.

```powershell
if (Test-Path -LiteralPath .env) {
    Write-Host ".env already exists; leaving it unchanged."
} else {
    $template = [System.IO.File]::ReadAllText((Join-Path (Get-Location) '.env.example'))

    function New-CryptoRandomBytes([int]$Count) {
        $bytes = New-Object byte[] $Count
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try {
            $rng.GetBytes($bytes)
        } finally {
            $rng.Dispose()
        }
        return ,$bytes
    }

    function New-Base64Secret([int]$Count) {
        $bytes = New-CryptoRandomBytes $Count
        return [Convert]::ToBase64String($bytes)
    }

    function New-UrlSafePassword([int]$Count) {
        $bytes = New-CryptoRandomBytes $Count
        return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    }

    $dbPassword = New-UrlSafePassword 24
    $jwtSecret = New-Base64Secret 32
    $refreshSecret = New-Base64Secret 32
    $daemonSecret = New-Base64Secret 32
    $totpBytes = New-CryptoRandomBytes 32
    $totpKey = [BitConverter]::ToString($totpBytes).Replace('-', '').ToLowerInvariant()

    $template = [regex]::Replace($template, '(?m)^POSTGRES_PASSWORD=.*$', "POSTGRES_PASSWORD=$dbPassword")
    $template = [regex]::Replace($template, '(?m)^DATABASE_URL=.*$', "DATABASE_URL=postgresql://mango:$dbPassword@localhost:15432/mangovpn?schema=public")
    $template = [regex]::Replace($template, '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$jwtSecret")
    $template = [regex]::Replace($template, '(?m)^REFRESH_SECRET=.*$', "REFRESH_SECRET=$refreshSecret")
    $template = [regex]::Replace($template, '(?m)^DAEMON_SHARED_SECRET=.*$', "DAEMON_SHARED_SECRET=$daemonSecret")
    $template = [regex]::Replace($template, '(?m)^TOTP_ENCRYPTION_KEY=.*$', "TOTP_ENCRYPTION_KEY=$totpKey")

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $template, $utf8NoBom)
    Write-Host "Created .env with fresh random secrets (UTF-8 without BOM). Keep it private."
}
```

**Linux / macOS (Bash):** Uses `openssl` (preinstalled on most systems) and writes a plain UTF-8 file.

```bash
if [ -e .env ]; then
  echo ".env already exists; leaving it unchanged."
else
  db_pw=$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=\n')
  jwt=$(openssl rand -base64 32 | tr -d '\n')
  refresh=$(openssl rand -base64 32 | tr -d '\n')
  daemon=$(openssl rand -base64 32 | tr -d '\n')
  totp=$(openssl rand -hex 32)

  cp .env.example .env
  sed -i \
    -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$db_pw|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://mango:$db_pw@localhost:15432/mangovpn?schema=public|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$jwt|" \
    -e "s|^REFRESH_SECRET=.*|REFRESH_SECRET=$refresh|" \
    -e "s|^DAEMON_SHARED_SECRET=.*|DAEMON_SHARED_SECRET=$daemon|" \
    -e "s|^TOTP_ENCRYPTION_KEY=.*|TOTP_ENCRYPTION_KEY=$totp|" \
    .env
  echo "Created .env with fresh random secrets. Keep it private."
fi
```

If you prefer to fill in `.env` by hand, copy `.env.example` to `.env` and replace each value with output from these cryptographically secure commands:

| `.env` key | Requirement | Windows (PowerShell) | Linux / macOS (Bash) |
|---|---|---|---|
| `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET` | ≥ 32 characters, each one independent | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)` | `openssl rand -base64 32` |
| `TOTP_ENCRYPTION_KEY` | exactly 64 hex characters | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [BitConverter]::ToString($b).Replace('-', '').ToLowerInvariant()` | `openssl rand -hex 32` |

Do not use `Get-Random` for secrets. Keep `DATABASE_URL`'s username, password, port, and database aligned with `POSTGRES_*`.

</details>

### What the `.env` variables do

| Variable(s) | Purpose |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Configure PostgreSQL for **both** the Docker `postgres` container (Tracks B/C) and the embedded PostgreSQL 16 started by `npm run db:start` (Track A, data in `.local/postgres`). The supplied template uses user `mango`, database `mangovpn`, and host port `15432`. |
| `DATABASE_URL` | Tells Prisma and a host-run API how to connect to that database. Keep its username, password, port, and database aligned with the PostgreSQL values. |
| `JWT_SECRET`, `REFRESH_SECRET` | Sign/secure API access and refresh sessions. Each must be at least 32 characters; the script makes independent random secrets. |
| `TOTP_ENCRYPTION_KEY` | Encrypts TOTP secret data; must be exactly 64 hexadecimal characters (32 bytes). |
| `DAEMON_SHARED_SECRET` | Shared API-to-gateway bearer credential; must be at least 32 characters and match in both services. |
| `NODE_ENV`, `PORT`, `API_PORT`, `CORS_ORIGIN` | API runtime, API port (default `4000`), and allowed portal origin (default `http://localhost:3000`). |
| `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`, `WG_DNS`, `WG_SERVER_ENDPOINT` | Gateway interface/network settings; local defaults include `wg0`, UDP `51820`, `10.13.13.1/24`, DNS `1.1.1.1`, and endpoint `127.0.0.1:51820`. |
| `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY` | Gateway's WireGuard server keypair. Optional for Track A's mock UI exercise; needed for Track B's real WireGuard tunnel. Keep the private key secret. |
| `VITE_API_URL`, `VITE_AGENT_URL`, `PORTAL_PORT` | Portal API/agent addresses and Docker portal host port. Local defaults use API `http://localhost:4000`, agent `http://127.0.0.1:47821`, and portal port `3000`. |

## Phase 3: Run the Project (3 Clear Tracks)

Choose **one** track. In this tutorial, every terminal command should run from the repository root unless a step explicitly says to change folders. Use `cd <path-to>/Mango_VPN_Trainee` (Linux/macOS) or `cd <path-to>\Mango_VPN_Trainee` (Windows) to get there first.

Environment variables in this phase are set **per terminal session**. Each block below shows both shells: PowerShell uses `$env:NAME=...` and `Remove-Item Env:NAME`; Bash uses `export NAME=...` and `unset NAME`.

### 🌧️ Track A: Rain's Workflow (Web Portal + Admin CRUD + Mock Agent Simulator, Docker-Free)

Track A needs **zero Docker**. It uses three local tools instead:

- **Embedded PostgreSQL 16** via `npm run db:start`, listening on `127.0.0.1:15432` and storing its data in `.local/postgres`.
- **Mock VPN Gateway Daemon** via `npm run mock:daemon`, a dev-only simulator of the gateway API on `http://127.0.0.1:50051`. It prints `[DEV MOCK DAEMON – no wg/nftables enforcement]`.
- **Mock Local Agent** via `npm run mock:agent`, on `http://127.0.0.1:47821`. It runs on Windows or Linux and auto-detects your OS for its platform value.

`POST /api/vpn/connect`, creating Policies, and revoking Devices/Sessions call the gateway at `127.0.0.1:50051`. Running `npm run mock:daemon` avoids `502 Bad Gateway` responses without Docker. It is **dev-only**: it does not program WireGuard or `nftables`, so it proves the API and UI flow, not real network enforcement. The mock agent likewise simulates the loopback contract and connected display; it does **not** install a WireGuard tunnel or prove real network traffic.

#### Step A1: Start embedded PostgreSQL and prepare the database

Open **Terminal 1** and start the embedded database. Leave it running:

```bash
npm run db:start
```

Press **Ctrl+C** in this terminal to stop PostgreSQL cleanly. Only after it has stopped, `npm run db:reset-local` wipes `.local/postgres`, which deletes all local database data.

Then open a **separate** terminal (the setup terminal) in the repository root and run:

```bash
npm run db:generate
npm run db:migrate
```

`db:generate` creates the Prisma client from the current schema. `db:migrate` applies the checked-in development migrations to the `mangovpn` database.

**What you should see:** Terminal 1 prints `PostgreSQL running at 127.0.0.1:15432` and creates both `mangovpn` (from `POSTGRES_DB`) and `mangovpn_v2_test`. Prisma generation and migration complete without errors in the setup terminal.

> **Test database (needed before `npm test`):** `npm test` uses `mangovpn_v2_test`. Migrate it once in the setup terminal, replacing `<password>` with `POSTGRES_PASSWORD` from `.env`.
>
> **Windows (PowerShell):**
>
> ```powershell
> $env:DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
> npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
> Remove-Item Env:DATABASE_URL
> ```
>
> **Linux / macOS (Bash):**
>
> ```bash
> export DATABASE_URL="postgresql://mango:<password>@127.0.0.1:15432/mangovpn_v2_test?schema=public"
> npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma
> unset DATABASE_URL
> ```
>
> Keep `DATABASE_URL` **unset** in the terminals that run `npm run dev:api`, so the API uses the `mangovpn` database from `.env`. If you exported it in this terminal, run `Remove-Item Env:DATABASE_URL` (PowerShell) or `unset DATABASE_URL` (Bash), or open a fresh terminal.

#### Step A2: Seed your first ADMIN account

Choose a private password of **at least 12 characters**. The example below is a placeholder: replace it with a password you choose, and **write down the username and password somewhere safe**. The password is not printed by the seed command.

**Windows (PowerShell):**

```powershell
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

**Linux / macOS (Bash):**

```bash
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

For example, a valid local test password could be `StaffTestPass#2026`; do not use that example for an internet-facing system. Keep at least 12 characters. The seed creates/upserts roles `ADMIN`, `STAFF`, and `CLIENT`, and the initial admin user. If you want a different login email, set `SEED_ADMIN_EMAIL` the same way (`$env:SEED_ADMIN_EMAIL` in PowerShell, `export SEED_ADMIN_EMAIL` in Bash) before running the seed; otherwise it uses `admin@mangovpn.local`.

**What you should see:** A message similar to `Seeded roles [ADMIN, STAFF, CLIENT] and ADMIN user "admin".` The prompt returns after the password variable is removed.

#### Step A3: Open five terminals

Keep all five terminals open while using the portal. Open each one in the repository root.

**Terminal 1 — Embedded PostgreSQL 16 (already running from Step A1)**

Leave the `npm run db:start` window open. Do not close it while the API or tests are using the database.

**Terminal 2 — Mock VPN Gateway Daemon (dev-only)**

```bash
npm run mock:daemon
```

**What you should see:** `[DEV MOCK DAEMON – no wg/nftables enforcement]`, followed by `This simulator does not program WireGuard or nftables.` and `Listening on http://127.0.0.1:50051`. The simulator reads `DAEMON_SHARED_SECRET` from `.env` and refuses to start if it is missing or shorter than 32 characters. It keeps peers and policies in memory only.

**Terminal 3 — Mock local agent**

```bash
npm run mock:agent
```

**What you should see:** A startup box headed `MANGO VPN - Local Windows Agent Simulator (v2)`, with address `http://127.0.0.1:47821`. Find `PairingToken:` and copy the complete token value. Leave this terminal running. The mock chooses a fresh token each time it starts unless you configure one yourself. The banner name is historical; the simulator runs on Linux too, and its platform value follows your OS (`linux-x64` on Linux, `windows-x64` on Windows).

**Terminal 4 — Control Plane API**

```bash
npm run dev:api
```

**What you should see:** Fastify's startup log reports that it is listening on `:4000` (usually `http://127.0.0.1:4000`). Leave it running. A missing/invalid secret or unavailable database prevents a successful start; check `.env` and the container status if so.

**Terminal 5 — Web Portal**

Choose **one** of these commands:

- **Single portal (Admin view on `:3000`):**

  ```bash
  npm run dev:portal
  ```

  **What you should see:** Vite prints `http://localhost:3000/`. Leave it running and open that address in your browser.

- **All three role portals (multi-role testing):**

  ```bash
  npm run dev:portal:all
  ```

  This runs `scripts/start-all-portals.mjs`, which starts three Vite servers at the same time:

  | Portal | URL | Role badge |
  |---|---|---|
  | Admin | `http://localhost:3000` | 🛡️ Admin (`ADMIN`) |
  | Staff | `http://localhost:3001` | 💼 Staff (`STAFF`) |
  | Client | `http://localhost:3002` | 🌐 Client (`CLIENT`) |

  The API (`Sobree/api`) and `mock-agent.js` both accept origins on ports `3000`–`3002` by default, so all three portals can talk to the same API and agent. Use this option for [Mission 4](#-mission-4-test-real-time-revocation--non-admin-rbac-staff-login). Press **Ctrl+C** once to stop all three.

### ⚡ Track B: Sobree's Workflow (Control Plane + Real Go Client Agent + WireGuard Tunnel)

Track B uses the real Go client agent. The agent is the same on both OSes, but the tunnel command differs:

- **Windows:** the agent runs `wireguard.exe /installtunnelservice` (tunnel config in `%TEMP%\mango-vpn\mango0.conf`). Install WireGuard for Windows first and run the agent from an **Administrator PowerShell**.
- **Linux:** the agent runs `wg-quick up` (tunnel config in `$TMPDIR/mango-vpn/mango0.conf`, usually `/tmp/mango-vpn/mango0.conf`). It requires `wireguard-tools` (`wg`, `wg-quick`), `iproute2`, `nftables`, and root (`sudo -E go run .`) or `CAP_NET_ADMIN`.

The gateway stays in Docker on both OSes because its `wg` and `nft` operations require Linux capabilities. On Linux you may optionally run `Sobree/vpn-daemon` natively instead; see Step B3.

#### Step B1: Start PostgreSQL and the gateway; configure the gateway keypair

```bash
docker compose up -d postgres vpn-gateway
docker compose ps
```

**What you should see:** `mango-postgres` and `mango-vpn-gateway` are running. Wait until their health checks report `healthy` before continuing.

If you created `.env` with `npm run env:init`, `WG_PRIVATE_KEY` and `WG_SERVER_PUBLIC_KEY` are already populated. If either value is blank (or you want to rotate the gateway keypair), run `npm run env:init -- --wg-only` on Windows or Linux:

```bash
npm run env:init -- --wg-only
```

Alternatively, you can ask the gateway container's `wg` tool to generate a keypair and write both values into `.env` without printing the private key:

**Windows (PowerShell):**

```powershell
$wgPrivate = (docker exec mango-vpn-gateway wg genkey).Trim()
$wgPublic = ($wgPrivate | docker exec -i mango-vpn-gateway wg pubkey).Trim()
$envPath = Join-Path (Get-Location) '.env'
$envText = [System.IO.File]::ReadAllText($envPath)
$envText = [regex]::Replace($envText, '(?m)^WG_PRIVATE_KEY=.*$', "WG_PRIVATE_KEY=$wgPrivate")
$envText = [regex]::Replace($envText, '(?m)^WG_SERVER_PUBLIC_KEY=.*$', "WG_SERVER_PUBLIC_KEY=$wgPublic")
[System.IO.File]::WriteAllText($envPath, $envText, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in .env (Server Public Key: $wgPublic)"
```

**Linux / macOS (Bash):**

```bash
wg_private=$(docker exec mango-vpn-gateway wg genkey | tr -d '\r\n')
wg_public=$(printf '%s' "$wg_private" | docker exec -i mango-vpn-gateway wg pubkey | tr -d '\r\n')
sed -i \
  -e "s|^WG_PRIVATE_KEY=.*|WG_PRIVATE_KEY=$wg_private|" \
  -e "s|^WG_SERVER_PUBLIC_KEY=.*|WG_SERVER_PUBLIC_KEY=$wg_public|" \
  .env
echo "Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in .env (Server Public Key: $wg_public)"
```

**What you should see:** `Updated WG_PRIVATE_KEY and WG_SERVER_PUBLIC_KEY in .env` followed by the generated server public key. Both `WG_PRIVATE_KEY` (kept inside the gateway) and `WG_SERVER_PUBLIC_KEY` (sent by the API to the agent) are now populated in `.env`.

Recreate the gateway so it loads the private key, then prepare the database and seed the admin. Use the same seed commands as Step A2 for your OS:

**Windows (PowerShell):**

```powershell
docker compose up -d vpn-gateway
npm run db:generate
npm run db:migrate
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

**Linux / macOS (Bash):**

```bash
docker compose up -d vpn-gateway
npm run db:generate
npm run db:migrate
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

Use the same password you intend to enter in the browser, and write it down safely. The password must be at least 12 characters. If you already seeded this same admin, running the seed again updates that account to the credentials supplied.

**What you should see:** The gateway returns to `healthy`; Prisma commands finish successfully; the seed reports the three roles and ADMIN user.

#### Step B2: Start the API and portal

Open two separate terminals in the repository root. In the first, run:

```bash
npm run dev:api
```

In the second, run:

```bash
npm run dev:portal
```

**What you should see:** The API logs that it is listening on `:4000`; Vite prints `http://localhost:3000/`. Leave both terminals open.

#### Step B3: Start the real Go client agent

Set the agent's local address, browser-origin allowlist, pairing token, and API address. Use this exact token for your local tutorial session, or replace it with another private token and remember it for pairing. Then run the agent in the way that matches your OS.

**Windows (Administrator PowerShell):** Right-click PowerShell and choose **Run as administrator**, then run:

```powershell
$env:AGENT_LISTEN_ADDR="127.0.0.1:47821"
$env:AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
$env:AGENT_PAIRING_TOKEN="my-local-dev-pairing-token-01"
$env:API_URL="http://localhost:4000"
cd <path-to>\Mango_VPN_Trainee\Sobree\agent-windows
go run .
```

The agent runs `wireguard.exe /installtunnelservice` to bring up `mango0`, so the Administrator PowerShell is required. `wireguard.exe` is provided by WireGuard for Windows.

**Linux (Bash):** The agent runs `wg-quick up` as root, so use `sudo -E` to keep your exported variables.

```bash
export AGENT_LISTEN_ADDR="127.0.0.1:47821"
export AGENT_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"
export AGENT_PAIRING_TOKEN="my-local-dev-pairing-token-01"
export API_URL="http://localhost:4000"
cd <path-to>/Mango_VPN_Trainee/Sobree/agent-windows
sudo -E go run .
```

The tunnel config is written to `/tmp/mango-vpn/mango0.conf` (or `$TMPDIR/mango-vpn/mango0.conf` if `TMPDIR` is set), and `wg-quick up` reads it. Running as root is needed for `wg-quick`, `ip`, and `nft`; `CAP_NET_ADMIN` alone may also work on a system where you have granted it.

**Optional on Linux: native `Sobree/vpn-daemon` instead of Docker `vpn-gateway`.** Stop the Docker gateway first so port `50051` and the WireGuard interface are free (`docker compose stop vpn-gateway`). Then, in a separate terminal with the `.env` values exported (`DAEMON_SHARED_SECRET`, `WG_PRIVATE_KEY`, `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`), run:

```bash
cd Sobree/vpn-daemon
sudo -E go run .
```

It listens on `127.0.0.1:50051` by default and needs root for `wg` and `nft`. Stop the daemon before restarting `vpn-gateway`.

**What you should see:** A Go log saying the agent is listening on `127.0.0.1:47821`. Keep this elevated terminal open. If the tunnel command cannot be found, install the WireGuard tools for your OS (see the troubleshooting table in Phase 6). If a different process already owns port `47821`, stop that process first.

### 🐳 Track C: One-Command Full Docker Stack (All 4 Containers)

Track C puts PostgreSQL, gateway, API, and portal in Docker. The browser still needs a **client agent running natively on your host** at `127.0.0.1:47821`. This works the same on Windows and Linux.

#### Step C1: Build and start the containers

```bash
docker compose up -d --build
docker compose ps
```

The API Dockerfile runs `prisma migrate deploy` automatically when the API container starts.

**What you should see:** All four services (`postgres`, `vpn-gateway`, `api`, and `portal`) show as up/running. PostgreSQL and the gateway have health checks and should show `healthy`; API and portal may show `Up` without a separate health label. The portal is published at `http://localhost:3000` and API at `http://localhost:4000`.

#### Step C2: Generate Prisma client if needed, and seed ADMIN

Run these commands on your host from the repository root. `npm run db:generate` is needed before host-side Prisma commands if you have not generated the client yet. The root `.env` supplies the host `DATABASE_URL`.

**Windows (PowerShell):**

```powershell
npm run db:generate
$env:SEED_ADMIN_USERNAME="admin"
$env:SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
Remove-Item Env:SEED_ADMIN_PASSWORD
```

**Linux / macOS (Bash):**

```bash
npm run db:generate
export SEED_ADMIN_USERNAME="admin"
export SEED_ADMIN_PASSWORD="<Choose-12+-Char-Password>"
npm run db:seed
unset SEED_ADMIN_PASSWORD
```

**What you should see:** Prisma generation succeeds and the seed reports the roles and initial ADMIN user. Use and safely record the password you chose; it must be at least 12 characters.

#### Step C3: Run an agent natively on your host

In a new terminal on your host, run one of these:

- `npm run mock:agent` (Track A behavior; no real tunnel). Works on Windows and Linux.
- The Go agent from Track B Step B3 (real tunnel). On Windows use Administrator PowerShell; on Linux use `sudo -E go run .`.

The agent must run on the host itself so the browser can reach `127.0.0.1:47821`.

**What you should see:** The mock startup box and `PairingToken:` in the first case, or the Go listening log in the second. The portal is available at `http://localhost:3000`.

## Phase 4: Step-by-Step Interactive Testing Playbook (“What to Do to Test It”)

The portal defaults to **Thai (`TH`)**. Use the **language toggle** (`EN` / `TH`) to switch to English, and the theme toggle to switch between light and dark. This tutorial uses English labels.

On the **Admin dashboard**, the **Windows Agent** card sits inside a collapsible VPN panel. The governance tabs are in the sidebar: **Audit Logs**, **Agent Versions**, **Users**, **Devices**, **Sessions**, and **Policies**.

### 🎯 Mission 1: First Sign-In & TOTP Authenticator Setup

1. Open `http://localhost:3000` in your browser. Enter username `admin` and the password you set during seeding, then click **Sign In**.

   **What you should see:** A **Set Up Authenticator** screen on first sign-in. If the account already enrolled TOTP, it will show **Two-Factor Verification** instead.

2. On first enrollment, use the QR code with Google Authenticator, Microsoft Authenticator, Authy, or another compatible TOTP authenticator. Alternatively, manually enter the displayed Base32 key in the app. Keep the key private; it can generate your sign-in codes.

   **What you should see:** The authenticator app creates a rotating six-digit code for MANGO VPN.

3. Enter the current code in **6-Digit Code**, then click **Verify**. If the code rolls over while you type, wait for the next one and enter it promptly.

   **What you should see:** The authenticated dashboard. It shows **Signed in as**, username `admin`, an `ADMIN` badge, a **Windows Agent** card (the client agent card; it works the same with the Linux agent), and the six-tab **Admin Governance** console. **Audit Logs** is selected by default.

### 🎯 Mission 2: Pair the Local Agent & Connect to the VPN

1. In the **Windows Agent** card, check that the agent is reachable. For the mock it should say **Agent Reachable (Unpaired)** and show version `v2.0.0`. Paste the copied mock `PairingToken` (or your chosen Go-agent token) into **Agent Pairing Token**, in the field with placeholder **Paste X-Mango-Agent-Token**, then click **Pair Agent**.

   **What you should see:** **Agent Paired & Ready**, `Tunnel State: disconnected`, and a **Connect VPN** button. If pairing fails, make sure the token exactly matches the currently running agent.

2. Click **Connect VPN**. In the background, the portal requests a single-use ticket valid for 60 seconds. The agent creates a fresh Curve25519 keypair in memory and presents the ticket and public key to the API. The API allocates the first available IP (normally `10.13.13.2`), then asks the gateway to add the peer and role `nftables` policy rules. With the Go agent, it then activates WireGuard (`wireguard.exe` on Windows, `wg-quick` on Linux); the mock only simulates the agent state and does not bring up a tunnel.

   **What you should see:** For the mock demo, the card reports green **connected**, `Connected Role: ADMIN`, `Assigned VPN IP: 10.13.13.2`, `Gateway Endpoint: 127.0.0.1:51820`, `Permitted Networks` (normally `10.13.13.0/24` if no ALLOW policy exists for ADMIN), `Curve25519 Key`, and **Disconnect VPN**. For Track B, you should also see the real `mango0` interface on your host: a WireGuard tunnel service on Windows, or `wg show mango0` on Linux. The displayed mock state/counters are not proof of real WireGuard traffic.

### 🎯 Mission 3: Test Every Admin Governance Tab (All 6 Tabs)

The Admin Governance tab order is **Audit Logs**, **Agent Versions**, **Users**, **Devices**, **Sessions**, **Policies**. Since **Audit Logs** is active by default, follow the numbered order below to create data first, then inspect the audit history at the end.

#### 1. Users

1. Click **Users**. Under **Create User**, enter username `staff01`, email `staff01@mangovpn.local`, password `StaffTestPass#2026`, and Role `STAFF`; click **Create User**.
2. Create another user with username `client01`, email `client01@mangovpn.local`, password `ClientTestPass#2026`, and Role `CLIENT`; click **Create User**.
3. Find `client01` in the list. Click **Disable**, wait for the status to update to `Disabled`, then click **Enable**.

**What you should see:** Both users appear in the list with their selected roles. `client01` changes from `Active` to `Disabled`, then back to `Active`. Admin-created passwords must be at least 12 characters.

#### 2. Policies

1. Click **Policies**. Under **Create Zero-Trust Policy**, create Policy 1 with:

   | Field | Value |
   |---|---|
   | Policy Name | `Allow Internal Web` |
   | Role | `STAFF` |
   | Target CIDR | `10.20.0.0/16` |
   | Protocol | `TCP` |
   | Port Range (TCP/UDP) | `443` |
   | Action | `ALLOW` |
   | Priority | `100` |

   Click **Create Policy**.

2. Create Policy 2 with:

   | Field | Value |
   |---|---|
   | Policy Name | `Block Admin Subnet` |
   | Role | `CLIENT` |
   | Target CIDR | `10.99.0.0/24` |
   | Protocol | `ANY` |
   | Port Range (TCP/UDP) | Leave blank |
   | Action | `DENY` |
   | Priority | `50` |

   Click **Create Policy**. A port range is only supported for TCP or UDP, so leave it blank for `ANY`.

**What you should see:** Both policies appear in the list with the correct role, CIDR, action, protocol, and priority. Optional: create a throwaway policy and click its **Delete** button; confirm it disappears without an error.

#### 3. Agent Versions

1. Click **Agent Versions**. Under **Publish Agent Version**, enter:

   | Field | Value |
   |---|---|
   | Version | `2.0.0` |
   | Platform | `windows-x64` on Windows, or `linux-x64` on Linux (must match your client OS) |
   | Download URL | `https://downloads.mango.local/mango-agent-2.0.0.exe` |
   | SHA-256 Checksum | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

   **Platform must match your client OS.** Both `Sobree/agent-windows` and `scripts/mock-agent.js` auto-detect the host OS (`windows-x64` on Windows, `linux-x64` on Linux) unless you set `AGENT_PLATFORM`. If you publish a version for the wrong platform, the agent will not find a matching release. Use the value your agent reports. The example above uses `windows-x64`; on Linux, use `linux-x64` with a matching download URL and checksum.

2. Check **Minimum required version**, then click **Publish Version**.

   **What you should see:** Version `2.0.0` appears as Active and Required. The URL is a sample registration value; it is not a real download location.

3. **Optional enforcement test (careful):** Disconnect the VPN if connected. Publish version `2.1.0` for your platform with a valid URL and 64-hex checksum and check **Minimum required version**. On the Windows Agent card, click **Connect VPN** again.

   **What you should see:** The API rejects the agent's `2.0.0` version with HTTP `426` and `AGENT_VERSION_OUTDATED`. In Agent Versions, click **Mark Optional** on `2.1.0` (the button appears for a required version). The `2.0.0` agent can connect again. Alternatively, **Deactivate** on the `2.1.0` record blocks that exact version, so do not deactivate `2.0.0` by mistake.

#### 4. Devices

Click **Devices**.

**What you should see:** Your connected machine appears with its hostname, device fingerprint, user `admin`, and status `ACTIVE`. The mock fingerprint is generated from its hostname unless you set `AGENT_DEVICE_FINGERPRINT`.

#### 5. Sessions

Click **Sessions**.

**What you should see:** A live `ACTIVE` session for `admin`, with assigned IP normally `10.13.13.2`. The table also shows the device hostname and has a **Disconnect** action.

#### 6. Audit Logs

Click **Audit Logs**. Look for security events from the actions above, such as `VPN_TICKET_ISSUED`, `VPN_CONNECTED`, `USER_CREATED`, `POLICY_CREATED`, and an agent-version creation event (shown by the API as `agent_version.create`). Try the **Action filter**, **Target type filter**, and **Search** boxes; for example, search for `admin` or filter by `USER_CREATED`.

**What you should see:** Recent events in a timestamped table. Click **Inspect** on an event to open its audit payload. Use **Close** to close the payload. Empty results are shown honestly as `No audit logs found.`

### 🎯 Mission 4: Test Real-Time Revocation & Non-Admin RBAC (`STAFF` Login)

Before you start, the simplest setup is a single portal (`npm run dev:portal`). For a cleaner multi-user test, use `npm run dev:portal:all` (Terminal 5 in Step A3) so each role has its own URL. You can also use the same portal for both roles by signing out and back in.

1. As `admin`, click **Sessions** and click **Disconnect** on the active session.

   **What you should see:** The session changes to `DISCONNECTED`, and the gateway removes its peer. For the mock, the local card may still display its previous connected state until you click **Disconnect VPN** or restart the mock. Admin disconnection removes the server-side peer; it does not remotely push a state change into the agent process.

2. **Device revocation is permanent for that fingerprint.** Clicking **Revoke** in **Devices** revokes the fingerprint so it cannot reconnect. You may test this if you want, but it is safer to leave your main demo device active. To use a fresh mock fingerprint instead, stop the mock with `Ctrl+C`, then set the override and restart it.

   **Windows (PowerShell):**

   ```powershell
   $env:AGENT_DEVICE_FINGERPRINT="mock-device-02"
   npm run mock:agent
   ```

   **Linux / macOS (Bash):**

   ```bash
   export AGENT_DEVICE_FINGERPRINT="mock-device-02"
   npm run mock:agent
   ```

   **What you should see:** A new mock startup box with a new `PairingToken:`. Pair using that new token. The new fingerprint is a distinct device identity. If you revoked `mock-device-02` earlier, choose another unused fingerprint. Remember to clear the variable afterwards (`Remove-Item Env:AGENT_DEVICE_FINGERPRINT` in PowerShell, `unset AGENT_DEVICE_FINGERPRINT` in Bash).

   **Per-port fingerprint isolation (mock agent):** `scripts/mock-agent.js` builds the device fingerprint from the base value (`AGENT_DEVICE_FINGERPRINT`, or a hash of the hostname) and **appends `-<port>`** based on the browser's origin port. A connection from `http://localhost:3000` is therefore a different device from `http://localhost:3001` or `:3002`. This is what lets `admin`, `staff01`, and `client01` each have their own device identity when you use `npm run dev:portal:all`, even with one mock agent. The Devices tab lists them as separate entries, for example `…-3000`, `…-3001`, and `…-3002`. The Go agent does **not** add this suffix; with the Go agent, set a different `AGENT_DEVICE_FINGERPRINT` per user instead (see step 4).

3. Before switching users, disconnect the local agent if it still shows connected. Click **Log Out**, then sign in as `staff01` with `StaffTestPass#2026`. First-time `staff01` sign-in will have its own TOTP enrollment: scan its QR code (or enter its Base32 key), type the current **6-Digit Code**, and click **Verify**.

   **What you should see:** The dashboard shows `staff01` and a `STAFF` badge. Staff users do not see the six **Admin Governance** tabs.

4. Pair the local agent again using its current token. With the **mock agent**, connecting from the Staff portal (`http://localhost:3001` with `dev:portal:all`) already gives `staff01` its own fingerprint suffix. With a single portal, you can instead set a fresh base fingerprint such as `mock-device-staff01` before restarting the mock:

   **Windows (PowerShell):**

   ```powershell
   $env:AGENT_DEVICE_FINGERPRINT="mock-device-staff01"
   npm run mock:agent
   ```

   **Linux / macOS (Bash):**

   ```bash
   export AGENT_DEVICE_FINGERPRINT="mock-device-staff01"
   npm run mock:agent
   ```

   Then paste the newly printed token, click **Pair Agent**, and click **Connect VPN**. With the **Go agent**, set `AGENT_DEVICE_FINGERPRINT` the same way before `go run .` (`$env:...` in Administrator PowerShell, or `export` before `sudo -E go run .`), because the Go agent does not add a port suffix.

   **What you should see:** `staff01` connects as `STAFF`. Because Mission 3 created an `ALLOW` policy for `STAFF`, **Permitted Networks** includes `10.20.0.0/16`. It may also include other allowed networks according to the configured policy data. The Admin Governance tabs remain hidden. The device fingerprint must not be the one used for `admin`.

## Phase 5: Live Gateway Inspection & Automated CLI Tests

### 5.1 Inspect the Docker gateway while a peer is registered (Track B and Track C only)

Track A's `npm run mock:daemon` runs on your host and has no `wg0` interface or `mango_vpn` nftables table, so skip this section for Track A. With a session connected in Track B or C, run these commands in any terminal. The gateway runs in Docker, so the commands are the same on Windows and Linux:

```bash
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
```

**What you should see:** `wg show` lists interface `wg0`, the listening port, and a peer with its public key/allowed IPs. The `nft` command prints the `inet mango_vpn` table and its forwarding rules. These commands show gateway configuration; a mock session still does not establish a real client tunnel or prove traffic is flowing.

On Linux with a real Go tunnel, you can also inspect the client side with `sudo wg show mango0`. On Windows, use the WireGuard for Windows app to view the `mango0` tunnel.

### 5.2 Probe the local agent

Replace `<your-pairing-token>` with the current token printed by the mock or explicitly set for the Go agent. A wrong or stale token produces `401`.

**Windows (PowerShell):**

```powershell
Invoke-RestMethod http://127.0.0.1:47821/health
Invoke-RestMethod http://127.0.0.1:47821/status -Headers @{ "X-Mango-Agent-Token" = "<your-pairing-token>" }
```

**Linux / macOS (Bash):**

```bash
curl -s http://127.0.0.1:47821/health
curl -s http://127.0.0.1:47821/status -H "X-Mango-Agent-Token: <your-pairing-token>"
```

**What you should see:** `/health` returns status `ok`, service name, version, and tunnel-active boolean. `/status` returns agent state, version, assigned IP/endpoint when connected, allowed IPs, and `bytesReceived` / `bytesSent`. With the mock these byte counters are simulated; with the Go agent they are reported by the agent's current implementation and may remain zero if the counters are not being updated. `curl` prints JSON without a trailing newline on some shells; that is normal.

### 5.3 Run automated verification

Run the guardrail scanner from the repository root. It is the same command on both OSes:

```bash
node scripts/check-guardrails.mjs
```

**What you should see:** `Guardrail check passed (0 violations).`

Build the TypeScript monorepo (same on both OSes):

```bash
npm run build
```

**What you should see:** Successful builds for shared contracts and applicable workspaces, with zero TypeScript build errors.

Before running tests, confirm the local `.env` database URL is present. Do not paste its value into a public log or chat.

**Windows (PowerShell):**

```powershell
if ($env:DATABASE_URL) { 'DATABASE_URL is set in this PowerShell session.' } else { 'DATABASE_URL is not exported in this PowerShell session; npm scripts load the root .env where configured. Check .env and the database if tests cannot connect.' }
npm test
```

**Linux / macOS (Bash):**

```bash
if [ -n "${DATABASE_URL:-}" ]; then echo 'DATABASE_URL is set in this shell.'; else echo 'DATABASE_URL is not exported in this shell; npm scripts load the root .env where configured. Check .env and the database if tests cannot connect.'; fi
npm test
```

Vitest suites run across API, Admin, and Portal workspaces. PostgreSQL must be running and the database must have the current v2 schema. For Track A, PostgreSQL is the embedded instance from `npm run db:start` (keep it running), and `mangovpn_v2_test` must be migrated as shown in Step A1. If a test expects an exported `DATABASE_URL`, set it for this terminal using the same URL from `.env` (`$env:DATABASE_URL="..."` in PowerShell, `export DATABASE_URL="..."` in Bash), then rerun `npm test`.

**What you should see:** Test suites report passed tests. If tests fail because PostgreSQL is unreachable or the schema is old, use the troubleshooting section below before treating the failure as a code defect.

For Sobree's Go modules, run these checks from the repository root.

**Windows (PowerShell):**

```powershell
Push-Location Sobree/agent-windows
go vet ./...
go test ./...
Pop-Location

Push-Location Sobree/vpn-daemon
go vet ./...
go test ./...
Pop-Location
```

**Linux / macOS (Bash):** The parentheses run each `cd` in a subshell, so your shell stays in the repository root.

```bash
(cd Sobree/agent-windows && go vet ./... && go test ./... && GOOS=windows go vet ./...)
(cd Sobree/vpn-daemon && go vet ./... && go test ./...)
```

**What you should see:** Both `go vet` and `go test` complete without errors in each module. In PowerShell, keep `Push-Location` / `Pop-Location` paired so the shell returns to the repository root even when following the commands line by line. The Bash `GOOS=windows go vet` line checks that the agent also compiles for Windows.

## Phase 6: Quick Troubleshooting & Clean Shutdown

### Quick troubleshooting

| Symptom | What it usually means | What to do |
|---|---|---|
| `502 Bad Gateway` during Connect, Policy creation/sync, or revocation | The API cannot reach the gateway daemon, or the daemon secret differs. | **Track A:** confirm `npm run mock:daemon` is running and listening on `http://127.0.0.1:50051`, and that `DAEMON_SHARED_SECRET` in `.env` is at least 32 characters (the simulator refuses to start otherwise). **Track B/C:** run `docker compose ps vpn-gateway` and wait for `healthy`, and check that `DAEMON_SHARED_SECRET` in root `.env` matches the Compose/API configuration. If you run `Sobree/vpn-daemon` natively on Linux, make sure the Docker `vpn-gateway` is stopped so that port `50051` is free. The host-run API uses `http://127.0.0.1:50051`; the API container uses `http://vpn-gateway:50051`. |
| Agent reports `401 Unauthorized` / `INVALID_PAIRING_TOKEN` | The token is missing, mistyped, or changed when the agent restarted. | Copy the newest mock `PairingToken:` or use the exact `AGENT_PAIRING_TOKEN` set before starting the Go agent. Pair again. |
| `403 FORBIDDEN_ORIGIN` | The portal's browser origin is not on the local agent allowlist. | Open the portal at `http://localhost:3000` (or `:3001` / `:3002` with `dev:portal:all`), or use the matching `http://127.0.0.1:300x` origin. For the Go agent, set `AGENT_ALLOWED_ORIGINS` to include the exact origin, then restart the agent. Do not use a wildcard origin. |
| `426 AGENT_VERSION_OUTDATED` or `AGENT_VERSION_INACTIVE` | A required version is newer than the agent, or this exact version has been deactivated. | In **Agent Versions**, make the required version optional with **Mark Optional**, or activate the correct release. Do not deactivate the version you are testing. |
| Agent version rejected for your platform | The **Platform** value in **Agent Versions** does not match the host OS. | Publish with `windows-x64` on Windows or `linux-x64` on Linux, or set `AGENT_PLATFORM` explicitly for both the mock and Go agent. |
| `Device has been revoked` | The agent is trying to reconnect with a permanently revoked device fingerprint. | Use a new, unused fingerprint for a new device identity. **PowerShell:** `$env:AGENT_DEVICE_FINGERPRINT="mock-device-02"`, then `npm run mock:agent`. **Bash:** `export AGENT_DEVICE_FINGERPRINT="mock-device-02"`, then `npm run mock:agent`. Pair again with the newly printed token. |
| Devices list shows unexpected `-3000`/`-3001`/`-3002` suffixes | This is the mock agent's per-port fingerprint isolation working as designed. | It is expected when you connect through `dev:portal:all`. Each portal URL is its own device identity. To reset, set `AGENT_DEVICE_FINGERPRINT` (PowerShell `$env:...`, Bash `export ...`) to a new base value and restart the mock. |
| `RoleName` does not exist or `connect_tickets` table is missing | The database still has a v1 schema or old migrations. Resetting removes local database data. | If you can safely discard the local database, run `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma`, then `npm run db:seed` with your admin environment variables. This reset is destructive to the local database. |
| `docker info` says `error during connect` (Windows) or `Cannot connect to the Docker daemon` (Linux) (Track B/C only) | Docker Desktop's engine is stopped or still starting (Windows), or the Docker Engine service is not running (Linux). | **Windows:** open **Docker Desktop** and wait until its bottom-left bar says **Engine running**, then retry. **Linux:** run `sudo systemctl start docker`. If you see `permission denied`, run `sudo usermod -aG docker "$USER"`, log out and back in, then retry `docker info`. |
| `wireguard.exe` not found or `wireguard.exe install failed` (Windows) | WireGuard for Windows is not installed, is not on `PATH`, or the agent was not started from an elevated window. | Install WireGuard for Windows, reopen an **Administrator PowerShell**, and rerun `go run .`. Read the exact error printed by the agent. |
| `wg-quick up failed` / `wg-quick: command not found` (Linux) | `wireguard-tools` is not installed, or the agent is not running as root. | Install `wireguard-tools`, `iproute2`, and `nftables` (see Phase 1). Run the agent with `sudo -E go run .`. If `sudo` reports `go: command not found`, use the full path to Go (`sudo -E "$(command -v go)" run .`), because `sudo` may use a reset `PATH`. |
| `wg-quick` reports `resolvconf: command not found` (Linux) | The generated config includes a `DNS =` line, and `wg-quick` needs a DNS manager to apply it. | Install a DNS manager such as `openresolv` (`sudo apt install -y openresolv`) or use `systemd-resolved`, then retry. |
| `mango0` or `wg show mango0` shows no interface / no handshake (Track B) | The real agent may not be elevated, the WireGuard tool may be missing, or the gateway public key/endpoint may be wrong. | **Windows:** run Go in Administrator PowerShell, install WireGuard for Windows, and verify `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`, and `WG_SERVER_ENDPOINT` are aligned. **Linux:** run with `sudo -E`, check `sudo wg show mango0`, and confirm UDP `51820` is reachable. Read the Go agent's exact error in its terminal. |
| Agent shows `Agent Unreachable` | No agent process is listening on the loopback port. | Start `npm run mock:agent` or the Go agent and check that it logs `127.0.0.1:47821`. Stop any other process using that port (`lsof -i :47821` on Linux, `netstat -ano \| findstr 47821` on Windows). |
| `API fails at startup with a required-variable error` | `.env` is missing or a required secret is invalid. | Check that `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, and `DAEMON_SHARED_SECRET` are set; the three secrets must each be at least 32 characters. `TOTP_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters. |

### Clean shutdown

1. In each terminal running `npm run mock:agent`, `npm run mock:daemon`, `npm run dev:api`, `npm run dev:portal`, `npm run dev:portal:all`, `go run .`, or `npm run db:start`, press **Ctrl+C** once. If the Go tunnel was active, click **Disconnect VPN** first when possible so the API and gateway remove the peer cleanly. Ctrl+C in `db:start` stops embedded PostgreSQL. Run `npm run db:reset-local` only after it has stopped, because it deletes `.local/postgres` and all local database data.

   **What you should see:** Each foreground process stops and your terminal returns to its prompt. For Track B, the tunnel should be removed when the agent disconnects successfully: WireGuard's tunnel service is removed on Windows, and `mango0` disappears from `ip link` on Linux.

2. Track B and Track C only: stop the Docker services from the repository root. Track A has no Docker services to stop.

   ```bash
   docker compose down
   ```

   **What you should see:** Compose reports the containers are stopped and removed. Your named PostgreSQL data volume is retained, so the next `docker compose up` can reuse the local database. Do not run `docker compose down -v` unless you deliberately want to delete that stored database data.

You have now walked through MANGO VPN v2 from setup to governance, agent pairing, gateway inspection, and shutdown. Nice work!
