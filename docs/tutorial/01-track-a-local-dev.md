> 🌐 **Language / ภาษา**: **English** | [🇹🇭 ภาษาไทย](th/01-track-a-local-dev.md)

> 🏠 [Tutorial index](../../TUTORIAL.md) › [00 Overview & Setup](00-overview-and-setup.md) › **01 Track A** › [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 Testing](04-testing-playbook.md) · [05 Troubleshooting](05-troubleshooting-and-reference.md) · [06 Appendix](06-appendix-local-docker-smoke-test.md)

---

# 01 · Track A: Rain's Workflow (Web Portal + Admin CRUD + Mock Agent, Docker-free)

Track A is the fastest way to learn the portal. It needs **no Docker**. Three local tools stand in for the production pieces:

- **Embedded PostgreSQL 16** via `npm run db:start`, listening on `127.0.0.1:15432`. Data lives in `.local/postgres`.
- **Mock VPN Gateway Daemon** via `npm run mock:daemon`, a dev-only simulator of the gateway API on `http://127.0.0.1:50051`. It prints `[DEV MOCK DAEMON – no wg/nftables enforcement]`.
- **Mock Local Agent** via `npm run mock:agent`, on `http://127.0.0.1:47821`. It runs on Windows or Linux and detects your OS for its platform value.

Connect, policy creation, and device or session revocation call the gateway at `127.0.0.1:50051`. Running `npm run mock:daemon` prevents `502 Bad Gateway` responses without Docker. It proves the API and UI flow, **not** real network enforcement. The mock agent simulates the loopback contract and the connected display; it does **not** install a WireGuard tunnel or carry real traffic.

> **Prerequisites:** [Chapter 00](00-overview-and-setup.md) is complete: `npm install`, `npm run build`, and `.env` created with `npm run env:init`.

> **How to read the commands:** Each step shows a **Windows (PowerShell)** block and a **Linux / macOS (Bash)** block where the commands differ. Environment variables are set **per terminal session**: PowerShell uses `$env:NAME=...` and `Remove-Item Env:NAME`; Bash uses `export NAME=...` and `unset NAME`.

---

## Step A1: Start embedded PostgreSQL and prepare the database

Open **Terminal 1** and start the embedded database. Leave it running:

```bash
npm run db:start
```

Press **Ctrl+C** in this terminal to stop PostgreSQL cleanly. Only after it has stopped should you run `npm run db:reset-local`, which wipes `.local/postgres` and deletes all local database data.

Open a **separate** setup terminal in the repository root and run:

```bash
npm run db:generate
npm run db:migrate
```

`db:generate` creates the Prisma client from the current schema. `db:migrate` applies the checked-in development migrations to the `mangovpn` database.

**What you should see:** Terminal 1 prints `PostgreSQL running at 127.0.0.1:15432` and creates both `mangovpn` (from `POSTGRES_DB`) and `mangovpn_v2_test`. Prisma generation and migration finish without errors in the setup terminal.

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

---

## Step A2: Seed your first ADMIN account

Choose a private password of **at least 12 characters**. The value below is a placeholder: replace it with your own, and **write down the username and password somewhere safe**. The seed command does not print the password.

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

The seed creates or updates the roles `ADMIN`, `STAFF`, and `CLIENT`, plus the initial admin user. To use a different login email, set `SEED_ADMIN_EMAIL` the same way before the seed runs. Otherwise the email is `admin@mangovpn.local`.

**What you should see:** A message similar to `Seeded roles [ADMIN, STAFF, CLIENT] and ADMIN user "admin".` The prompt returns after the password variable is removed.

---

## Step A3: Open five terminals

Keep all five terminals open while you use the portal. Open each one in the repository root.

**Terminal 1: Embedded PostgreSQL 16** (already running from Step A1). Leave the `npm run db:start` window open. Do not close it while the API or tests use the database.

**Terminal 2: Mock VPN gateway daemon (dev-only)**

```bash
npm run mock:daemon
```

**What you should see:** `[DEV MOCK DAEMON – no wg/nftables enforcement]`, then `This simulator does not program WireGuard or nftables.`, then `Listening on http://127.0.0.1:50051`. The simulator reads `DAEMON_SHARED_SECRET` from `.env` and refuses to start if it is missing or shorter than 32 characters. It keeps peers and policies in memory only.

**Terminal 3: Mock local agent**

```bash
npm run mock:agent
```

**What you should see:** A startup box headed `MANGO VPN - Local Windows Agent Simulator (v2)`, with address `http://127.0.0.1:47821`. Find `PairingToken:` and copy the complete value. Leave this terminal running. The mock picks a fresh token on each start unless you configure one. The banner name is historical: the simulator also runs on Linux, and its platform value follows your OS (`linux-x64` on Linux, `windows-x64` on Windows).

**Terminal 4: Control Plane API**

```bash
npm run dev:api
```

**What you should see:** Fastify logs that it is listening on `:4000` (usually `http://127.0.0.1:4000`). Leave it running. A missing or invalid secret, or an unavailable database, prevents a successful start. Check `.env` and the database if so.

**Terminal 5: Web portal**

```bash
npm run dev:portal
```

**What you should see:** Vite prints `http://localhost:3000/`. Open that address in your browser. All roles (`ADMIN`, `STAFF`, `CLIENT`) sign in through this single portal URL.

### Shortcut: `npm run dev:demo`

`npm run dev:demo` starts the mock agent and three role-specific portals: Admin on `:3000`, Staff on `:3001` (`somchai_staff`), and Client on `:3002` (`wansob_test`). `npm run dev:portal:all` starts the same three portals without the agent. Neither command starts the API or the gateway daemon. Run `npm run db:start`, `npm run mock:daemon`, and `npm run dev:api` alongside them.

---

## What you should have running

| Terminal | Command | Address |
|---|---|---|
| 1 | `npm run db:start` | `127.0.0.1:15432` |
| 2 | `npm run mock:daemon` | `http://127.0.0.1:50051` |
| 3 | `npm run mock:agent` | `http://127.0.0.1:47821` |
| 4 | `npm run dev:api` | `http://localhost:4000` |
| 5 | `npm run dev:portal` | `http://localhost:3000` |

**What you should see before moving on:** Sign-in to `http://localhost:3000` works with the admin password from Step A2. Continue with [chapter 04](04-testing-playbook.md) to run Missions 1 to 4.

---

**Next:** [04 Testing Playbook](04-testing-playbook.md) → (Missions 1 to 4 and the automated suite)

> 🏠 [Tutorial index](../../TUTORIAL.md) › [00 Overview & Setup](00-overview-and-setup.md) › **01 Track A** › [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · [04 Testing](04-testing-playbook.md) · [05 Troubleshooting](05-troubleshooting-and-reference.md) · [06 Appendix](06-appendix-local-docker-smoke-test.md)
