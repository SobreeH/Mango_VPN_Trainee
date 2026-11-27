> 🌐 **Language / ภาษา**: **English** | [🇹🇭 ภาษาไทย](th/06-appendix-local-docker-smoke-test.md)

← Previous: [Troubleshooting & Reference](05-troubleshooting-and-reference.md) | 📚 [Tutorial Index](../../TUTORIAL.md) | Next: —

# 🧪 Appendix: Local Docker Smoke Test (Single Machine)

This appendix preserves the original **single-machine** smoke test that does not
need GNS3 or a cloud VM. It is the fastest way to prove the API, portal,
database, gateway, and a client agent work together on one laptop. For the
networked labs, see [Track B: GNS3 Mock Cloud](02-track-b-gns3-mock-cloud.md) and
[Track C: Cloud Deployment](03-track-c-cloud-deployment.md).

There are two options. Choose **one**.

- **Option 1** - host-run API/portal + Docker `postgres` and `vpn-gateway`
  (plus an optional `docker-compose.test-targets.yml` role harness).
- **Option 2** - all four containers in Docker via `docker compose up -d --build`.

Both need a `.env` at the repository root. Create it once with:

```bash
npm run env:init
```

This writes `.env` with a fresh `POSTGRES_PASSWORD`, `JWT_SECRET`,
`REFRESH_SECRET`, `DAEMON_SHARED_SECRET`, a 64-hex `TOTP_ENCRYPTION_KEY`, and a
Curve25519 WireGuard keypair. Do not paste its values into chat or commit it.

---

## Option 1: Host API/Portal + Docker `postgres` & `vpn-gateway`

This matches the original Track B flow: only the database and the Linux gateway
run in Docker; the API and portal run on your host with `npm`, and the client
agent runs natively on your host.

### 1.1 Start `postgres` and `vpn-gateway`

```bash
docker compose up -d postgres vpn-gateway
docker compose ps
```

**What you should see:** `mango-postgres` and `mango-vpn-gateway`. Wait until
their health checks report `healthy`.

If `WG_PRIVATE_KEY` / `WG_SERVER_PUBLIC_KEY` are blank, populate them. The
cross-platform way:

```bash
npm run env:init -- --wg-only
```

Alternatively, generate them with the gateway container's own `wg` tool without
printing the private key:

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

Recreate the gateway so it loads the private key, then prepare and seed the
database:

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

**What you should see:** The gateway returns to `healthy`; Prisma generation and
migration finish; the seed reports `Seeded roles [ADMIN, STAFF, CLIENT] and ADMIN
user "admin".` The password must be at least 12 characters.

### 1.2 Run the API and portal on the host

Open two terminals in the repository root:

```bash
npm run dev:api      # terminal A
npm run dev:portal   # terminal B
```

**What you should see:** The API logs that it is listening on `:4000`; Vite
prints `http://localhost:3000/`. Leave both running.

### 1.3 Run a client agent natively on the host

The portal calls `127.0.0.1:47821`, so the agent must run on your host, not in
Docker. Choose one:

- **Mock (no real tunnel):** `npm run mock:agent`. It prints a startup box with
  `PairingToken:`. Copy that token.
- **Real Go agent:** see Step B5 of the main tutorial. On Windows use an
  Administrator PowerShell; on Linux use `sudo -E "$(command -v go)" run .`.

**What you should see:** Either the mock box with `PairingToken:`, or the Go
agent's `listening on 127.0.0.1:47821` log.

### 1.4 Optional - prove role enforcement with the local target harness

This uses the same three static targets as Track B, but on one machine.

1. Seed the Track B policies:

   ```bash
   npm run db:seed:test-targets
   ```

   **What you should see:** `Seeded 12 Track B VPN policies.` The seeder upserts
   by role and name; it updates the Mission 3 rows named `Allow Internal Web`
   (STAFF) and `Block Admin Subnet` (CLIENT) instead of duplicating them, and
   sets `Allow Internal Web` to priority `101`.

2. Start the test stack:

   ```bash
   npm run docker:test-targets:up
   ```

   This runs `docker compose -f docker-compose.yml -f docker-compose.test-targets.yml`
   with `postgres vpn-gateway target-routes target-admin target-staff target-client
   test-harness`. Run it again after restarting `vpn-gateway`, because
   `target-routes` runs only once (`restart: "no"`).

3. Make sure the agent's `AGENT_ALLOWED_ORIGINS` includes the harness origins
   (`http://localhost:3090,http://127.0.0.1:3090`). Restart the agent if you
   changed the allowlist.

4. Open `http://localhost:3090` and use the page for the role you are testing
   (`/admin.html`, `/staff.html`, or `/client.html`). The harness is published
   only on `127.0.0.1:${TEST_HARNESS_PORT:-3090}`.

   Enter the agent URL (default `http://127.0.0.1:47821`), paste the pairing
   token, click **Save**, then **Check /health** and **Get /status**.

5. Connect the tunnel as the user for that role, then click **Probe All 3 VPN
   Targets**. Each row shows **REACHABLE**/**BLOCKED**/**TIMEOUT** plus
   **PASS**/**MISMATCH**. A probe that times out after 3.5 seconds is reported as
   `TIMEOUT`. The index page shows `N/A (overview)` and checks no role.

**Expected access matrix:**

| Connected role | `10.99.0.10` (admin) | `10.20.0.10` (staff) | `10.30.0.10` (client) |
| --- | --- | --- | --- |
| ADMIN | ALLOW | ALLOW | ALLOW |
| STAFF | DENY | ALLOW | ALLOW |
| CLIENT | DENY | DENY | ALLOW |

**Manual HTTPS check:** the harness probes only HTTP. To check HTTPS, connect the
tunnel and run:

```bash
curl -k https://10.20.0.10/health.json
```

Use `-k` because each target's certificate is self-signed with `CN` set to the
target IP.

> [!NOTE]
> The test stack does **not** stop with plain `docker compose down`, because that
> command does not include `docker-compose.test-targets.yml`. Stop it with
> `npm run docker:test-targets:down`.

---

## Option 2: Full 4-Container Docker Compose Stack

This matches the original one-command demo: PostgreSQL, gateway, API, and portal
all in Docker. The browser still needs a client agent running natively on your
host at `127.0.0.1:47821`. It works the same on Windows and Linux.

### 2.1 Build and start the containers

```bash
docker compose up -d --build
docker compose ps
```

The API image runs `prisma migrate deploy` automatically at container start
(`npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma && node
Sobree/api/dist/server.js`).

**What you should see:** `postgres`, `vpn-gateway`, `api`, and `portal` all
running. `postgres` and `vpn-gateway` report `healthy`; `api` and `portal` may
show `Up` without a separate health label. The portal is published at
`http://localhost:3000` and the API at `http://localhost:4000`.

### 2.2 Generate the Prisma client if needed, and seed ADMIN

Run these on your host from the repository root. The root `.env` supplies the
host `DATABASE_URL` (`localhost:15432`).

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

**What you should see:** Prisma generation succeeds and the seed reports the
roles and initial ADMIN user.

Optional - add the Track B policies for the role-enforcement matrix:

```bash
npm run db:seed:test-targets
```

### 2.3 Run an agent natively on the host

In a new host terminal, run one of:

- `npm run mock:agent` (no real tunnel; works on Windows and Linux), or
- the Go agent from Track B Step B5 (real tunnel; Administrator PowerShell on
  Windows, `sudo -E "$(command -v go)" run .` on Linux).

**What you should see:** The mock startup box with `PairingToken:` in the first
case, or the Go listening log in the second. The portal is at
`http://localhost:3000`.

### 2.4 Inspect the Docker gateway (while connected)

The gateway runs in Docker, so the commands are identical on both OSes:

```bash
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
```

**What you should see:** `wg show` lists interface `wg0`, its listening port, and
a peer with its public key and allowed IPs. The `nft` command prints the
`inet mango_vpn` table and its forwarding rules.

---

## Clean shutdown

Stop host processes first (**Ctrl+C** in each terminal running `npm run
dev:api`, `npm run dev:portal`, `npm run mock:agent`, or `go run .`). If the Go
tunnel was connected, click **Disconnect** first.

Then stop Docker.

- **If you used the test-targets stack (Option 1, step 1.4):**

  ```bash
  npm run docker:test-targets:down
  ```

  **What you should see:** Compose removes `postgres`, `vpn-gateway`, the three
  targets, `target-routes`, and `test-harness`. Named volumes are kept.

- **Otherwise (Option 1 base, or Option 2):**

  ```bash
  docker compose down
  ```

  **What you should see:** The containers are stopped and removed. The named
  PostgreSQL data volume is retained, so the next `docker compose up` reuses it.
  Do **not** add `-v` unless you deliberately want to delete the stored database
  data.

---

← Previous: [Troubleshooting & Reference](05-troubleshooting-and-reference.md) | 📚 [Tutorial Index](../../TUTORIAL.md) | Next: —
