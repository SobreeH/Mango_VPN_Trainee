> 🌐 **Language / ภาษา**: **English** | [🇹🇭 ภาษาไทย](th/05-troubleshooting-and-reference.md)

> 🏠 [Tutorial index](../../TUTORIAL.md) › [00 Overview & Setup](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 Testing](04-testing-playbook.md) · **05 Troubleshooting** · [06 Appendix](06-appendix-local-docker-smoke-test.md)

---

# 05 · Troubleshooting, Environment Reference & Clean Shutdown

Use this chapter when a step in any track does not behave as its **What you should see** note describes. Find your symptom in the table, then follow the fix. The reference sections at the end list every environment variable the tutorial uses, and the shutdown sections show how to stop each track without losing data you want to keep.

---

## Troubleshooting

| Symptom | What it usually means | What to do |
|---|---|---|
| `502 Bad Gateway` during Connect, policy creation or sync, or revocation | The API cannot reach the gateway daemon, or the daemon secret differs. | **Track A:** confirm `npm run mock:daemon` is running and listening on `http://127.0.0.1:50051`, and that `DAEMON_SHARED_SECRET` in `.env` is at least 32 characters (the simulator refuses to start otherwise). **Tracks B and C:** run `docker compose ps vpn-gateway` and wait for `healthy`, and check that `DAEMON_SHARED_SECRET` in the root `.env` matches the Compose and API configuration. If you run `Sobree/vpn-daemon` natively on Linux, stop the Docker `vpn-gateway` so port `50051` is free. The host-run API uses `http://127.0.0.1:50051`; the API container uses `http://vpn-gateway:50051`. |
| Agent returns `401 Unauthorized` / `INVALID_PAIRING_TOKEN` | The token is missing, mistyped, or changed when the agent restarted. | Copy the newest mock `PairingToken:`, or use the exact `AGENT_PAIRING_TOKEN` you set before starting the Go agent. Pair again. |
| `403 FORBIDDEN_ORIGIN` | The portal's browser origin is not on the agent's allow-list. | Open the portal at `http://localhost:3000` (or `http://127.0.0.1:3000`). For the Go agent, set `AGENT_ALLOWED_ORIGINS` to include the exact origin, then restart the agent. Do not use a wildcard origin. |
| `426 AGENT_VERSION_OUTDATED` or `AGENT_VERSION_INACTIVE` | A required version is newer than the agent, or this exact version has been deactivated. | In **Agent Versions**, make the required version optional with **Mark Optional**, or activate the correct release. Do not deactivate the version you are testing. |
| Agent version rejected for your platform | The **Platform** value in **Agent Versions** does not match the host OS. | Publish with `windows-x64` on Windows or `linux-x64` on Linux, or set `AGENT_PLATFORM` explicitly for both the mock and the Go agent. |
| `Device has been revoked` (HTTP `403`) | The agent is reconnecting with a permanently revoked device fingerprint. | Use a new, unused fingerprint for a new device identity. **PowerShell:** `$env:AGENT_DEVICE_FINGERPRINT="mock-device-02"`, then `npm run mock:agent`. **Bash:** `export AGENT_DEVICE_FINGERPRINT="mock-device-02"`, then `npm run mock:agent`. Pair again with the newly printed token. |
| Devices list shows `-<username>` suffixes | The mock agent's per-user fingerprint isolation is working as designed. | This is expected when you test several accounts on `http://localhost:3000`. To reset, set `AGENT_DEVICE_FINGERPRINT` (PowerShell `$env:...`, Bash `export ...`) to a new base value and restart the mock. |
| `RoleName` does not exist, or the `connect_tickets` table is missing | The database still has a v1 schema or old migrations. Resetting removes local database data. | If you can safely discard the local database, run `npx prisma migrate reset --force --schema=Sobree/api/prisma/schema.prisma`, then `npm run db:seed` with your admin variables. This reset is destructive to the local database. |
| `Connect ticket has expired` (HTTP `401`) | The ticket is single-use and valid for 60 seconds. You waited too long, or the ticket was already redeemed. | Click **Connect VPN** again to request a new ticket. |
| `docker info` says `error during connect` (Windows) or `Cannot connect to the Docker daemon` (Linux) (Tracks B and C) | Docker Desktop's engine is stopped or still starting (Windows), or the Docker Engine service is not running (Linux). | **Windows:** open **Docker Desktop**, wait until its status bar says **Engine running**, then retry. **Linux:** run `sudo systemctl start docker`. If you see `permission denied`, run `sudo usermod -aG docker "$USER"`, log out and back in, then retry `docker info`. |
| `wireguard.exe` not found, or `wireguard.exe install failed` (Windows) | WireGuard for Windows is not installed, is not on `PATH`, or the agent was not started from an elevated window. | Install WireGuard for Windows, reopen an **Administrator PowerShell**, and rerun `go run .`. Read the exact error the agent prints. |
| `wg-quick up failed` or `wg-quick: command not found` (Linux) | `wireguard-tools` is not installed, or the agent is not running as root. | Install `wireguard-tools`, `iproute2`, and `nftables` (see [chapter 00](00-overview-and-setup.md#31-install-the-tools-for-your-track)). Run the agent with `sudo -E go run .`. If `sudo` reports `go: command not found`, use the full path to Go (`sudo -E "$(command -v go)" run .`), because `sudo` may reset `PATH`. |
| `wg-quick` reports `resolvconf: command not found` (Linux) | The generated config includes a `DNS =` line, and `wg-quick` needs a DNS manager to apply it. | Install a DNS manager such as `openresolv` (`sudo apt install -y openresolv`), or use `systemd-resolved`, then retry. |
| `mango0` or `wg show mango0` shows no interface or no handshake (Track B) | The real agent may not be elevated, the WireGuard tool may be missing, or the gateway public key or endpoint may be wrong. | **Windows:** run Go in an Administrator PowerShell, install WireGuard for Windows, and verify `WG_PRIVATE_KEY`, `WG_SERVER_PUBLIC_KEY`, and `WG_SERVER_ENDPOINT` are aligned. **Linux:** run with `sudo -E`, check `sudo wg show mango0`, and confirm UDP `51820` is reachable. Read the Go agent's exact error in its terminal. |
| Portal on a remote `http://` address cannot reach the agent | Browser Private Network Access blocks a non-local page from calling `127.0.0.1:47821`. | Use `http://localhost:3000` for local work, trust Caddy's internal CA for `https://vpn.mango.lab` in [chapter 02](02-track-b-gns3-mock-cloud.md), or serve Track C over HTTPS (`<IP>.sslip.io` / custom domain / ACM / SSH tunnel) per [chapter 03](03-track-c-cloud-deployment.md). |
| GNS3 clients bypass VPN or reach targets before connecting (Track B) | The WAN router mistakenly has static routes for `10.13.13.0/24` or `10.99/10.20/10.30`. | Re-run `deploy/gns3/setup-wan-router.sh` and confirm `ip route` on the WAN router only knows `192.168.50.0/24` and `203.0.113.0/24`. |
| GNS3 targets time out even after WireGuard connects (Track B) | Missing return route on the VPC Private Router or Ubuntu control-plane VM, or `nft` `forward` dropped the flow. | Confirm `10.13.13.0/24 via 172.28.0.2` on the Private Router (`setup-private-router.sh`), `10.99/10.20/10.30 via 172.28.0.1` on the Ubuntu VM, and inspect `nft list table inet mango_vpn` inside `vpn-gateway`. |
| Caddy fails Let's Encrypt issuance on `sslip.io` or custom domain (Track C1) | Port `80` or `443` is blocked in the cloud Security Group, or DNS points to the wrong IP. | Allow inbound TCP `80` and `443` in the VM Security Group, confirm `MANGO_DOMAIN` resolves to the VM's public IP, or use the SSH tunnel + `:80` fallback in `deploy/cloud-vm/Caddyfile`. |
| Managed AWS API tasks fail to start or gateway drops forwarded traffic (Track C2) | `TotpEncryptionSecret` still holds the placeholder, `ApiDesiredCount` was set to `1` before ECR images were pushed, or `SourceDestCheck` is enabled. | Populate `TotpEncryptionSecret` (`openssl rand -hex 32`) and `WireGuardKeySecret` first, push all 3 ECR images, then update `ApiDesiredCount=1` & `PortalDesiredCount=1`. Keep `SourceDestCheck: false` on `WireGuardGatewayInstance` and `VpnReturnRoute` (`10.13.13.0/24`) in `PrivateRouteTable`. |
| Agent shows `Agent Unreachable` | No agent process is listening on the loopback port. | Start `npm run mock:agent` or the Go agent, and check that it logs `127.0.0.1:47821`. Stop any other process using that port: `lsof -i :47821` on Linux, `netstat -ano \| findstr 47821` on Windows. |
| API fails at startup with a required-variable error | `.env` is missing, or a required secret is invalid. | Check that `DATABASE_URL`, `JWT_SECRET`, `REFRESH_SECRET`, and `DAEMON_SHARED_SECRET` are set. The three secrets must each be at least 32 characters. `TOTP_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters. |

---

## Environment variable reference

Values come from the root `.env` (created by `npm run env:init`) unless a row says otherwise. Export or set variables only in the terminal that needs them.

### Database and API

| Variable | Default or example | Used by |
|---|---|---|
| `POSTGRES_USER` | `mango` | Embedded PostgreSQL, Docker `postgres` |
| `POSTGRES_PASSWORD` | generated | Embedded PostgreSQL, Docker `postgres` |
| `POSTGRES_DB` | `mangovpn` | Embedded PostgreSQL, Docker `postgres` |
| `POSTGRES_PORT` | `15432` (host port for the container's `5432`) | Compose |
| `DATABASE_URL` | `postgresql://mango:<password>@localhost:15432/mangovpn?schema=public` | Prisma, host-run API. Leave it unset in terminals that run `dev:api` if you are using `.env`. |
| `JWT_SECRET`, `REFRESH_SECRET` | generated, at least 32 characters | API |
| `TOTP_ENCRYPTION_KEY` | generated, exactly 64 hex characters | API |
| `DAEMON_SHARED_SECRET` | generated, at least 32 characters | API, gateway daemon, mock daemon |
| `NODE_ENV`, `PORT`, `API_PORT` | API port `4000` | API |
| `CORS_ORIGIN` | `http://localhost:3000` | API |

### Seeding (set per command, then unset)

| Variable | Purpose |
|---|---|
| `SEED_ADMIN_USERNAME` | Username for the first ADMIN account (`admin` in this handbook). |
| `SEED_ADMIN_PASSWORD` | Password, at least 12 characters. It is never printed. |
| `SEED_ADMIN_EMAIL` | Optional. Defaults to `<username>@mangovpn.local`. |

### Gateway and WireGuard

| Variable | Default or example | Used by |
|---|---|---|
| `WG_INTERFACE` | `wg0` | Gateway |
| `WG_LISTEN_PORT` | `51820` (UDP) | Gateway |
| `WG_GATEWAY_CIDR` | `10.13.13.1/24` | Gateway |
| `WG_DNS` | `1.1.1.1` | Client config |
| `WG_SERVER_ENDPOINT` | `127.0.0.1:51820` | API (sent to the agent) |
| `WG_PRIVATE_KEY` | generated | Gateway only. Keep it secret. |
| `WG_SERVER_PUBLIC_KEY` | generated | API and agent |
| `VPN_DAEMON_URL` | `http://127.0.0.1:50051` (host-run API) | API |

### Portal

| Variable | Default | Used by |
|---|---|---|
| `VITE_API_URL` | `http://localhost:4000` | Portal |
| `VITE_AGENT_URL` | `http://127.0.0.1:47821` | Portal |
| `PORTAL_PORT` | `3000` | Compose portal host port |

### Local agent

These are read by the Go agent (`Sobree/agent-windows`) and, where noted, by `scripts/mock-agent.js`.

| Variable | Example | Purpose |
|---|---|---|
| `AGENT_LISTEN_ADDR` | `127.0.0.1:47821` | Loopback address the agent listens on. |
| `AGENT_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000,http://localhost:3090,http://127.0.0.1:3090` | Comma-separated browser origins. Never use a wildcard. |
| `AGENT_PAIRING_TOKEN` | any private string | Pairing token. If unset, the Go agent generates one at startup. |
| `API_URL` | `http://localhost:4000` | Control Plane API the agent calls. |
| `AGENT_DEVICE_FINGERPRINT` | `mock-device-02` | Overrides the device identity. The mock adds `-<username>` when the portal sends the dev-user hint. |
| `AGENT_PLATFORM` | `windows-x64` or `linux-x64` | Overrides OS auto-detection for both agents. |

### Test harness (Track B appendix)

| Variable | Purpose |
|---|---|
| `TEST_HARNESS_PORT` | Port for the localhost role harness (default `3090`). See [chapter 06](06-appendix-local-docker-smoke-test.md). |

---

## Clean shutdown

Stop things in this order: foreground processes first, then any containers or cloud stacks. Ctrl+C in each terminal stops that process.

### Track A

1. In each terminal running `npm run mock:agent`, `npm run mock:daemon`, `npm run dev:api`, or `npm run dev:portal`, press **Ctrl+C** once.
2. In the `npm run db:start` terminal, press **Ctrl+C** last. This stops embedded PostgreSQL.
3. Run `npm run db:reset-local` **only** if you want to delete all local data. It removes `.local/postgres`, so run it only after PostgreSQL has stopped.

**What you should see:** Each process stops and the prompt returns. Track A has no Docker services to stop.

### Track B (GNS3)

Follow the shutdown steps in [chapter 02](02-track-b-gns3-mock-cloud.md). In general, click **Disconnect** in the portal before stopping the Go agent, so the API and gateway remove the peer cleanly.

### Track C1 (single cloud VM)

From the repository root on the VM, stop and remove the containers while keeping the database volume:

```bash
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml --env-file .env.cloud down
```

Add `-f deploy/cloud-vm/docker-compose.cloud-targets.yml` if you started that overlay. Do not add `-v` unless you deliberately want to destroy the PostgreSQL volume.

**What you should see:** Compose reports the containers stopped and removed. The named PostgreSQL volume remains.

### Track C2 (managed AWS stack)

Delete the CloudFormation stack and then the ECR repositories that were retained, as documented in [`deploy/aws-managed/README.md`](../../deploy/aws-managed/README.md#7-teardown):

```bash
aws cloudformation delete-stack --stack-name mango-vpn-managed
aws cloudformation wait stack-delete-complete --stack-name mango-vpn-managed
```

The stateful RDS instance, ECR repositories, and CloudWatch log groups use `DeletionPolicy: Retain` or `Snapshot`, so they survive stack deletion. Remove them only after you have verified the data is no longer needed. The README lists the `aws ecr delete-repository --force` commands for the retained repositories.

**What you should see:** The stack reaches `DELETE_COMPLETE`. Retained resources remain until you delete them.

### Appendix: local Docker smoke test

Stop the Docker stack with the matching script. Do not use plain `docker compose down` for the test-target stack, because it does not include `docker-compose.test-targets.yml`:

```bash
npm run docker:test-targets:down
```

For the plain stack, run `docker compose down` from the repository root. Named volumes are kept. Do not run `docker compose down -v` unless you deliberately want to delete stored database data.

**What you should see:** Compose removes the containers. Named volumes are kept.

---

**Back to:** [Tutorial index](../../TUTORIAL.md) · **Start over:** [00 Overview & Setup](00-overview-and-setup.md)

> 🏠 [Tutorial index](../../TUTORIAL.md) › [00 Overview & Setup](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 Testing](04-testing-playbook.md) · **05 Troubleshooting** · [06 Appendix](06-appendix-local-docker-smoke-test.md)
