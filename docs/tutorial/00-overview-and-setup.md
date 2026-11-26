> 🌐 **Language / ภาษา**: **English** | [🇹🇭 ภาษาไทย](th/00-overview-and-setup.md)

> 🏠 [Tutorial index](../../TUTORIAL.md) › **00 Overview & Setup** › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 Testing](04-testing-playbook.md) · [05 Troubleshooting](05-troubleshooting-and-reference.md) · [06 Appendix](06-appendix-local-docker-smoke-test.md)

---

# 00 · Overview & Setup

Welcome! This chapter explains what MANGO VPN does, how a connection moves through the system, and prepares your computer. Every later chapter assumes you finished the two phases here.

> **How to read the commands:** Each step that needs a shell shows a **Windows (PowerShell)** block and a **Linux / macOS (Bash)** block. Use the one for your OS. Commands without a platform label (such as `npm run ...`) are identical on both.

> **Safety note:** This is a local development/demo setup, not a production deployment. Keep your `.env` file private, and do not reuse its generated secrets anywhere else.

## 1. The 60-second big picture

MANGO VPN lets a user sign in with a password and a time-based one-time password (TOTP) from an authenticator app. Users never download a VPN `.conf` file. After sign-in, the portal obtains a **single-use connect ticket that expires after 60 seconds**. A local **client agent** on the user's machine (Windows or Linux) listens at `127.0.0.1:47821`. It generates a fresh Curve25519 keypair in memory, sends its public key to the Control Plane API, and activates WireGuard. The gateway installs that peer and enforces the user's role policies with `nftables`.

The client agent comes in two forms:

- **`Sobree/agent-windows`** (Go): the real agent. On **Windows** it runs `wireguard.exe /installtunnelservice`. On **Linux** it runs `wg-quick up`.
- **`scripts/mock-agent.js`** (Node.js): a simulator of the same loopback contract for UI work. It does **not** install a tunnel on either OS.

### 1.1 Components

```mermaid
flowchart LR
    Browser["Web Portal (localhost:3000)"] -->|HTTP API| API["Control Plane API (localhost:4000)"]
    API -->|SQL| DB[("PostgreSQL 16 (localhost:15432)")]
    Browser -->|Loopback + pairing token| Agent["Local Client Agent (127.0.0.1:47821)"]
    Agent -->|Ticket redemption + public key| API
    API -->|Bearer-authenticated HTTP| Gateway["Gateway Daemon (127.0.0.1:50051)"]
    Agent -->|WireGuard UDP| WG["WireGuard gateway (51820/udp)"]
    Gateway -->|wg + nftables| WG
```

| Component | Local address / port | What it does |
|---|---|---|
| Web Portal | `http://localhost:3000` | Sign-in, TOTP enrollment, VPN controls, and the Admin Governance UI. |
| Control Plane API | `http://localhost:4000` | Password/TOTP auth, short-lived connect tickets, IP allocation, and gateway coordination. |
| PostgreSQL 16 | `localhost:15432` (container port `5432`) | Stores users, sessions, policies, devices, and audit history. Track A runs it embedded with `npm run db:start` (data in `.local/postgres`); Tracks B and C run the Docker container `mango-postgres`. |
| Local Client Agent | `http://127.0.0.1:47821` | `scripts/mock-agent.js` for UI demos, or the Go `Sobree/agent-windows` for a real WireGuard tunnel. |
| Gateway Daemon | `http://127.0.0.1:50051` (HTTP); `51820/udp` (WireGuard) | Programs `wg0` and role-based `nftables` rules. Track A simulates it with `npm run mock:daemon` (dev-only; no `wg` or `nftables` enforcement). Tracks B and C run the Docker service `mango-vpn-gateway`. |

### 1.2 The v2 connection lifecycle

A connection passes through six stages. The flowchart shows the decision points; the sequence shows the messages in order.

```mermaid
flowchart TD
    A["1. Password sign-in"] --> B{"TOTP enrolled?"}
    B -->|No| C["MFA_SETUP_REQUIRED: scan QR, verify code"]
    B -->|Yes| D["Enter 6-digit code"]
    C --> E["2. Rotating JWT access + refresh session"]
    D --> E
    E --> F["3. Portal requests a 60-second single-use connect ticket"]
    F --> G["4. Agent creates Curve25519 keypair in memory"]
    G --> H["5. API checks role, allocates IP, programs gateway peer and policies"]
    H --> I{"Agent type"}
    I -->|Go agent| J["6a. Agent activates WireGuard (wireguard.exe or wg-quick)"]
    I -->|mock-agent.js| K["6b. Mock simulates connected state only"]
```

```mermaid
sequenceDiagram
    autonumber
    participant P as Portal (browser)
    participant A as Local agent (127.0.0.1:47821)
    participant API as Control Plane API (:4000)
    participant GW as Gateway daemon (:50051)
    P->>API: POST /api/auth/login, then /api/auth/verify-otp
    API-->>P: Access + refresh session (rotating JWT)
    P->>API: POST /api/vpn/ticket (authenticated)
    API-->>P: Single-use ticket, expires in 60 s
    P->>A: POST /connect with pairing token and ticket
    A->>A: Generate Curve25519 keypair (in memory)
    A->>API: POST /api/vpn/connect (ticket, publicKey, deviceFingerprint, hostname, agentVersion, platform)
    API->>GW: Add peer and role policies (Bearer DAEMON_SHARED_SECRET)
    GW-->>API: Peer and policies accepted
    API-->>A: Assigned IP and gateway public key and endpoint
    A->>A: Activate tunnel (Go agent only)
    A-->>P: Connected status
```

Key rules that the lifecycle enforces:

- A ticket can be redeemed **once** and only within **60 seconds**. Expired tickets are rejected with `401` and the message `Connect ticket has expired`.
- Each role gets only the policies assigned to that role. Connect reads enabled policies for the user's role, ordered by priority ascending.
- A revoked device fingerprint can never reconnect. Revocation is permanent for that fingerprint.

### 1.3 Why `supportsDevUserHint` matters

The portal runs at one URL (`http://localhost:3000`) for all roles. In development it needs a way to tell the mock agent which user is signed in, so each user gets an isolated agent state.

- The mock agent reports `supportsDevUserHint: true` from its `GET /health` response.
- The portal's `AgentStatusCard` sends the `X-Mango-Dev-User` header **only** when the agent reports `supportsDevUserHint: true`. With the real Go agent the hint is never sent.
- The mock agent then appends `-<username>` to the device fingerprint, so `admin`, `staff01`, and `client01` each have their own device identity.
- The Go agent's production CORS allow-list does not include `X-Mango-Dev-User`, and it does not add this suffix. For multi-user tests with the Go agent, set a different `AGENT_DEVICE_FINGERPRINT` per user.

### 1.4 Why HTTPS matters for remote portals

Browsers apply **Private Network Access (PNA)** rules. A page loaded from a public or remote origin is not allowed to call `127.0.0.1` without a permission handshake. The agent answers PNA preflight requests, but a plain `http://` page served from a remote hostname is still blocked from reaching the loopback agent. This is why local work uses `http://localhost:3000` (which the browser treats as local), [chapter 02](02-track-b-gns3-mock-cloud.md) uses Caddy's internal CA (`https://vpn.mango.lab`), and [chapter 03](03-track-c-cloud-deployment.md) covers HTTPS via `<IP>.sslip.io`, custom domains, ACM, or SSH/SSM port forwarding.

## 2. Which track should I choose?

The full chooser table is on the [tutorial index](../../TUTORIAL.md#which-track-should-i-choose). In short:

- **Track A** (chapter [01](01-track-a-local-dev.md)): Docker-free. Best for learning the portal and Admin CRUD.
- **Track B** (chapter [02](02-track-b-gns3-mock-cloud.md)): a GNS3 mock cloud lab with a real gateway and WireGuard tunnel.
- **Track C** (chapter [03](03-track-c-cloud-deployment.md)): a single cloud VM (C1) or the managed AWS stack (C2).

## 3. Phase 1: Check your computer is ready

### 3.1 Install the tools for your track

| Tool | Track A | Tracks B and C | Why it is needed |
|---|---|---|---|
| Node.js `>=18` (recommended `20 LTS`) | Required | Required | Runs the API, portal, build, mock simulators, and tests. |
| npm `>=9` | Required | Required | Installs the monorepo workspaces. npm comes with Node.js. |
| Git `>=2.30` | Required | Required | Gets and manages the project files. |
| Docker Desktop (Windows) or Docker Engine + Compose v2 (Linux) | Not needed | Required | Runs PostgreSQL and the Linux gateway. |
| Go `>=1.26` (`Sobree/agent-windows`); Go `1.22` (`Sobree/vpn-daemon`) | Not needed for the mock agent | Required for the Go agent | The Go agent module requires Go 1.26. The Linux daemon module lists Go 1.22. |
| WireGuard: WireGuard for Windows (`wireguard.exe`); or `wireguard-tools` (`wg`, `wg-quick`), `iproute2`, and `nftables` (`nft`) on Linux | Not needed | Required for a real tunnel | Provides the tunnel commands the Go agent uses to bring up `mango0`. |

Linux package example (Debian/Ubuntu; use your distribution's equivalents):

```bash
sudo apt update
sudo apt install -y wireguard-tools iproute2 nftables openssl
```

**Track A needs no Docker.** It uses embedded PostgreSQL (`npm run db:start`) and the dev-only gateway simulator (`npm run mock:daemon`). Neither simulator programs WireGuard or `nftables`.

### 3.2 Open a terminal in the repository

Open **PowerShell** (Windows) or a **terminal** (Linux/macOS) and change to the repository folder. Replace the placeholder with the path where you cloned the project:

**Windows (PowerShell):**

```powershell
cd <path-to>\Mango_VPN_Trainee
```

**Linux / macOS (Bash):**

```bash
cd <path-to>/Mango_VPN_Trainee
```

### 3.3 Run the readiness check

Run the same command on either OS:

```bash
npm run check:env
```

Track A should run the role-specific check instead. It marks Docker CLI, Docker Compose, Docker Desktop/Engine, and Go as `OPTIONAL`:

```bash
npm run check:env -- --role Rain
```

On Windows, `npm run check:env -- -Role Rain` also works.

**What you should see:** A table with tool status and versions, followed by a readiness summary when Node.js, npm, and Git are available. On Linux the script also checks `wg`, `wg-quick`, `ip`, and `nft`; on Windows it checks `wireguard.exe`. The script only detects whether commands are on `PATH`. It does not install tools or validate WireGuard configuration.

Check the Go version separately if you plan to use the real agent:

```bash
go version
```

**What you should see:** `go1.26` or newer. If your shell says a command is not recognized, install it and open a new terminal so the updated `PATH` is loaded.

### 3.4 Check Docker is running (Tracks B and C only)

Skip this section for Track A.

- **Windows:** Open **Docker Desktop** and wait until the bottom-left status bar says **Engine running**.
- **Linux (Docker Engine):** Start the service, then add your user to the `docker` group if you see a permission error (log out and back in afterwards):

  ```bash
  sudo systemctl start docker
  sudo usermod -aG docker "$USER"
  ```

Then run the same check on either OS:

```bash
docker info
```

**What you should see:** A long report with both **Client** and **Server** sections. `error during connect` (Windows) or `Cannot connect to the Docker daemon` (Linux) means the engine is not running yet. The Docker command-line program alone is not enough.

## 4. Phase 2: First-time install and `.env` setup

Run these steps from the repository root.

### 4.1 Install and build

```bash
npm install
npm run build
```

`npm install` installs dependencies for every npm workspace. `npm run build` builds `@mango/shared` first, then the other workspaces that have build scripts.

**What you should see:** `npm install` finishes without an `npm ERR!` failure. The build ends with successful workspace output and no TypeScript errors. Warnings are not necessarily failures; an error and a non-zero exit code are.

### 4.2 Create `.env` with strong secrets

The API and Docker Compose need a root `.env` file. Run the cross-platform initializer. It works identically on **Windows (PowerShell)** and **Linux / macOS (Bash)**:

```bash
npm run env:init
```

`scripts/init-env.mjs` starts from `.env.example` and writes `.env` (UTF-8 **without a BOM**, file mode `0600`) containing:

- a URL-safe random `POSTGRES_PASSWORD`, with the same password written into `DATABASE_URL`;
- independent 32-byte Base64 values for `JWT_SECRET`, `REFRESH_SECRET`, and `DAEMON_SHARED_SECRET`;
- a 64-hex-character `TOTP_ENCRYPTION_KEY` (32 bytes);
- a Curve25519 WireGuard keypair for `WG_PRIVATE_KEY` and `WG_SERVER_PUBLIC_KEY`.

If `.env` already exists, the script **does not overwrite existing secrets**. It fills in blank `WG_PRIVATE_KEY` or `WG_SERVER_PUBLIC_KEY` values if they are missing. Supported options:

| Option | Effect |
|---|---|
| `--force` | Regenerates everything. |
| `--wg-only` | Rotates only the WireGuard keypair. |
| `--output <path>` | Writes to a different file instead of `.env`. |

**What you should see:** On a new setup, `Created .env with fresh random secrets and WireGuard keypair (UTF-8 without BOM). Server Public Key: ...`. If `.env` already has every value populated, the script reports that it left the file unchanged. Do not paste secret values into chat or commit `.env`.

<details>
<summary>Alternative: manual generation in your shell (optional)</summary>

If you prefer not to use `npm run env:init`, generate `.env` directly. Run the block for your OS from the repository root.

**Windows (PowerShell):** Uses the .NET cryptographic random-number generator and writes UTF-8 **without a BOM**. It needs no `openssl`.

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

**Linux / macOS (Bash):** Uses `openssl` and writes a plain UTF-8 file.

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

To fill `.env` by hand, copy `.env.example` to `.env` and replace each value with output from these commands:

| `.env` key | Requirement | Windows (PowerShell) | Linux / macOS (Bash) |
|---|---|---|---|
| `JWT_SECRET`, `REFRESH_SECRET`, `DAEMON_SHARED_SECRET` | ≥ 32 characters, each one independent | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)` | `openssl rand -base64 32` |
| `TOTP_ENCRYPTION_KEY` | exactly 64 hex characters | `$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [BitConverter]::ToString($b).Replace('-', '').ToLowerInvariant()` | `openssl rand -hex 32` |

Do not use `Get-Random` for secrets. Keep `DATABASE_URL`'s username, password, port, and database aligned with `POSTGRES_*`.

</details>

### 4.3 What the `.env` variables do

| Variable(s) | Purpose |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Configure PostgreSQL for both the embedded instance (Track A) and the Docker `postgres` container (Tracks B and C). The template uses user `mango`, database `mangovpn`, and host port `15432`. |
| `DATABASE_URL` | Tells Prisma and a host-run API how to connect. Keep its username, password, port, and database aligned with the PostgreSQL values. |
| `JWT_SECRET`, `REFRESH_SECRET` | Sign API access and refresh sessions. Each must be at least 32 characters. |
| `TOTP_ENCRYPTION_KEY` | Encrypts TOTP secret data. Must be exactly 64 hexadecimal characters. |
| `DAEMON_SHARED_SECRET` | Shared API-to-gateway bearer credential. At least 32 characters, and it must match in both services. |
| `NODE_ENV`, `PORT`, `API_PORT`, `CORS_ORIGIN` | API runtime, API port (default `4000`), and allowed portal origin (default `http://localhost:3000`). |
| `WG_INTERFACE`, `WG_LISTEN_PORT`, `WG_GATEWAY_CIDR`, `WG_DNS`, `WG_SERVER_ENDPOINT` | Gateway interface and network settings. Local defaults: `wg0`, UDP `51820`, `10.13.13.1/24`, DNS `1.1.1.1`, and endpoint `127.0.0.1:51820`. |
| `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY` | The gateway's WireGuard keypair. Optional for Track A's mock exercise; required for a real tunnel in Tracks B and C. Keep the private key secret. |
| `VITE_API_URL`, `VITE_AGENT_URL`, `PORTAL_PORT` | Portal API and agent addresses, and the Docker portal host port. Local defaults: API `http://localhost:4000`, agent `http://127.0.0.1:47821`, portal `3000`. |

The complete reference is in [chapter 05](05-troubleshooting-and-reference.md#environment-variable-reference).

**What you should see before moving on:** `npm install` and `npm run build` succeed, `.env` exists, and `npm run check:env` shows your required tools as available.

---

**Next:** [01 Track A: Local Dev (Docker-free)](01-track-a-local-dev.md) →

> 🏠 [Tutorial index](../../TUTORIAL.md) › **00 Overview & Setup** › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 Testing](04-testing-playbook.md) · [05 Troubleshooting](05-troubleshooting-and-reference.md) · [06 Appendix](06-appendix-local-docker-smoke-test.md)
