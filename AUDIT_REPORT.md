# MANGO VPN — Comprehensive Security & Quality Audit Report

| | |
|---|---|
| **Date** | 2026-11-19 |
| **Target** | `Mango_VPN_Trainee` — Zero-Trust Role-Based WireGuard VPN Management System |
| **Commit audited** | `main` @ `9562c53` (66 tracked files) |
| **Method** | 6 parallel audit sub-agents + orchestrator source-verification (see Appendix A) |
| **Mode** | **READ-ONLY.** No project file was created, modified, or deleted; no build, install, migration, or server was run. This report is the only new file. |

---

## 1. Executive Summary

MANGO VPN is a **well-organized prototype with a clean repository and several correctly-implemented primitives, but it is not currently a functioning zero-trust product, and as shipped it is exploitable with nothing more than a copy of this repository.**

The headline problem is that **the repository itself is the attack surface**. The JWT signing secrets, the database password, the seed account password, and the MFA bypass fallback are all committed literals — and the OTP is printed to stdout. Concretely:

- Anyone who can read this repo can **forge an `ADMIN` token** and call the live VPN endpoints (`POST /api/vpn/connect`) — *Critical C1*.
- Anyone who can read this repo can **log in as `admin_user`** (`MangoVPN2026!` is committed, logged, and pre-filled in the login form) and read the OTP from the API's own logs — *High H1, H3*.
- Any **website in a user's browser** can connect/disconnect their VPN tunnel, because the Windows agent reflects any `Origin` with credentials and Private-Network access, and `/disconnect` has no authentication — *Critical C2*.

Beyond authentication, the product's core claim — role-based network segmentation — **does not exist on the server**: the API never calls the vpn-daemon, `DENY` rules are inverted into *allowed* routes, `isEnabled`/device revocation are dead data, and the gateway container is stock `linuxserver/wireguard` with `ALLOWEDIPS=0.0.0.0/0`. The "wg set / nftables" integration the README describes is **log-only stubs** (*Critical C3*).

The frontend compounds this: a **mock login that bypasses MFA is compiled into the production bundle** (triggered on any API error), admin screens **fabricate success toasts and render `MOCK_*` data as real** — including when the API legitimately returns empty tables — and every Docker deployment is broken by a Vite build-time variable bug that silently pushes users into that mock path.

**Verdict: not deployable.** The remediation list in §9 is ordered and concrete; the P0 items are genuine blockers for any environment beyond a developer laptop.

### Severity dashboard

| Severity | Count | Summary |
|---|---|---|
| **Critical** | 4 | Committed JWT secrets · Agent PNA cross-site control · Zero-trust enforcement absent/inverted · `SYS_MODULE` container escape vector |
| **High** | 17 | OTP logging + weak generation + no rate limiting · default password everywhere · weak/published DB · admin routes unguarded · peer hijack · IPAM race · dead revocation · pool exhaustion DoS · daemon trust boundary (escalates to Critical) · mock MFA login in prod · fabricated admin UI · supply-chain install fallback · Docker config breakage |
| **Medium** | 27 | Enumeration timing, stale-role tokens, CORS, error leakage, missing validation, no transactions, no admin audit trail, unbounded queries, CI gaps, doc overclaims, … |
| **Low / Info** | 24 | Missing `go.sum`, untracked `PROGRESS.md`, a11y gaps, dead code, doc drift, … |

All 4 Critical and all 17 High findings were **independently re-verified at the cited source lines by the orchestrator** before inclusion (Appendix B lists severity reconciliations).

---

## 2. Critical Findings

### C1 — Committed JWT/refresh signing secrets → full token forgery

**Verified at:** `Sobree/api/src/modules/auth/auth.service.ts:13,15` · `Sobree/api/src/middleware/auth.middleware.ts:17` · `docker-compose.yml:61,63` · `Sobree/api/package.json:22`

- `JWT_SECRET` and `REFRESH_SECRET` fall back to the committed literals `'mango-vpn-jwt-insecure-secret-key-32chars'` / `'mango-vpn-refresh-token-insecure-secret'`.
- The shipped Compose stack **hardcodes the same literals** as the API's environment — the deployed system *always* runs with a publicly-known signing key.
- `dotenv` is declared as a dependency but **imported nowhere** (verified by grep): a `.env` file silently does nothing, so the fallback/compose value is what signs and verifies every token.
- Impact: anyone with repo access can mint a valid `accessToken` with `role: "ADMIN"` and any `userId`, then call the (properly-guarded) VPN routes directly. This defeats the entire RBAC control plane.

**Fix:** remove both literals and the compose secrets; fail startup when secrets are missing/weak (≥32 random bytes); import `dotenv/config` or use `--env-file`; rotate the exposed values; pin `{ algorithms: ['HS256'] }` on verify.

### C2 — Windows Agent: any website can drive the VPN tunnel (PNA CSRF) + unauthenticated endpoints

**Verified at:** `Sobree/agent-windows/main.go:64-84` (`withPNA`), `:112-165` (`/connect`), `:167-186` (`/disconnect`), `:190-193` (mounting); mirrored in `scripts/mock-agent.js:50-60`

- `withPNA` reflects the request `Origin` verbatim into `Access-Control-Allow-Origin`, sets `Access-Control-Allow-Credentials: true`, and unconditionally grants `Access-Control-Allow-Private-Network: true`. No origin allowlist.
- `POST /disconnect` performs **no authentication at all**; `POST /connect` only checks that the token is non-empty — it is never validated and the backend call is a TODO stub (`:144`), so a fake token still produces a "connected" state with a hardcoded IP.
- Impact: a malicious page open in the user's browser can silently **tear down the corporate tunnel** (DoS), force fake connect states, and read `/status` (assigned IP, public key, counters, errors).

**Fix:** explicit origin allowlist (portal origins only); require a valid `accessToken` on `/disconnect` too; validate the token cryptographically or via the backend before any state change; keep `Allow-Private-Network` gated on the preflight request header and a shared local secret.

### C3 — Zero-trust enforcement does not exist on the server, and the policy model is inverted

**Verified at:** `Sobree/api/src/modules/vpn/vpn.service.ts:37-142, 110-112` · `Sobree/vpn-daemon/main.go:74-103` (log-only stubs) · `docker-compose.yml:22-49`

- The API **never calls the vpn-daemon** (grep: zero references to the daemon/socket/wg0/nftables in `Sobree/api`). `connect()` writes DB rows and returns a client-advisory config; `disconnect()` never releases the peer. The gateway is the stock `linuxserver/wireguard` image with `ALLOWEDIPS=0.0.0.0/0` and no per-peer rules — a compliant client is free to route anywhere it can.
- `allowedIps = rolePolicies.map(p => p.destinationCidr)` (`:110-112`) includes **every policy regardless of `action`** — creating a `DENY` rule **widens** the client's allowed routes. `protocol` and `portRange` are never consulted anywhere.
- A role with zero policies falls back to the broad default `10.13.13.0/24,10.0.0.0/8` (`:11,112`) — fail-open.
- The daemon's `registerPeer`/`removePeer`/nftables code paths only `log.Printf` the intended `wg set` / `nft` commands; `executeCommand` (`vpn-daemon/main.go:45-52`) is never invoked.

**Impact:** the product's defining feature (role-based segmentation) is unenforced, and its policy data model actively inverts the meaning of DENY. **Fix:** filter to `ALLOW` policies, compute DENY exclusions, pass full rules (proto/port/action) to the daemon, call `/peers/register`+`/peers/remove` on connect/disconnect (rollback on failure), and only then enable the daemon's `exec` path.

### C4 — `SYS_MODULE` capability + host `/lib/modules` mount on the VPN gateway

**Verified at:** `docker-compose.yml:26-28` (`cap_add: NET_ADMIN, SYS_MODULE`), `:47` (`/lib/modules:/lib/modules:ro`), `:23` (`linuxserver/wireguard:latest`, unpinned)

- `SYS_MODULE` allows loading kernel modules into the **host** kernel; the read-only module tree still supplies loadable modules. Combined with an unpinned `:latest` image, a compromised or regressed gateway image is effectively **host-root equivalent**.

**Fix:** drop `SYS_MODULE` and the `/lib/modules` mount (use `NET_ADMIN` only), pin the image by digest, add `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `read_only: true` with explicit writable paths. **[NEEDS-VERIFY]** `docker compose config` + in-container `modprobe -n <module>` to confirm.

---

## 3. High Findings

> All line references verified by the orchestrator.

**H1 — OTP written to stdout in plaintext.** `auth.service.ts:66-70` logs username, challengeId, and the live 6-digit OTP unconditionally. Anyone with log access completes login. **Fix:** delete the logging; deliver via a real MFA provider.

**H2 — OTP uses `Math.random()` and has no attempt limit.** `auth.service.ts:55`; `verifyOtp` (`:99-112`) never counts failures or invalidates the challenge, and no rate-limit plugin exists anywhere (routes: `auth.routes.ts`). Unlimited guessing within the 5-minute window + non-CSPRNG generation. **Fix:** `crypto.randomInt`, per-challenge/per-IP limits, invalidate after N failures. **[NEEDS-VERIFY]** scripted brute-force test in staging.

**H3 — Default password `MangoVPN2026!` is committed, logged, reused, and advertised.** `Rain/admin/src/seed.ts:67-68,105` (all three roles share it; re-seeding **resets** it via the upsert `update` block `:94-104`) · `Rain/admin/src/admin.service.ts:38` (`POST /api/users` fallback) · `Rain/portal/src/App.tsx:33` (pre-filled on every visit), `:170` (shown in the error toast), `:160` (mock check) · `LoginForm.tsx:40` (demo fill) · `AdminPanel.tsx:248` (sent on user creation) · documented in `Rain/README.md:84-86`. **Fix:** random per-user initial passwords delivered out-of-band, force rotation at first login, never log, reject password-less creation.

**H4 — PostgreSQL: known credentials, published port.** `docker-compose.yml:7-11` (`mango`/`mangosecret` defaults, `5432:5432` published on all interfaces), reused in `DATABASE_URL` (`:60`) and in CI (`.github/workflows/ci.yml:18,44`). **Fix:** no host port (or `127.0.0.1:` binding), `${POSTGRES_PASSWORD:?required}`, distinct throwaway CI creds.

**H5 — Admin API mounted without authentication.** `Rain/admin/src/admin.routes.ts:7-16` registers every admin route bare (only the VPN routes attach `authenticate`, `vpn.routes.ts:8-9`; no global hook exists — verified). **Corrected mechanics** (reconciled from four agents): with `request.user` never populated, `getDevices`/`getSessions`/`getUsers`/`getPolicies`/`getAuditLogs`/`createUser`/`createPolicy`/`deletePolicy`/`deleteDevice` all **fail closed (401/403) — the admin console is dead even for real admins** — while `GET /api/agent-versions` (`admin.controller.ts:73-88`) has **no check at all and is publicly readable**. The in-handler self-policing pattern is one refactor away from open exposure. **Fix:** `authenticate` + explicit `requireRole('ADMIN')` preHandlers on all admin routes; mark any intentionally public route explicitly. **[NEEDS-VERIFY]** `curl` matrix with ADMIN/CLIENT/no token.

**H6 — Peer hijack via public-key reassignment.** `vpn.service.ts:73-84`: an existing `publicKey` re-binds `userId`/`deviceId` to the caller with no ownership check (public keys are not secrets — the agent prints them). After takeover the original owner cannot even disconnect (`:153` compares against the *new* owner). **Fix:** require `peer.userId === userId`, validate `deviceId` ownership.

**H7 — IPAM TOCTOU race + raw error leak.** `vpn.service.ts:17-32` (read-all → pick-first-free → create; no transaction/lock/retry). The `@unique` on `assignedIp` prevents corruption but the loser gets an unhandled Prisma `P2002` → **catch-all 500 with `err.message` verbatim** (`vpn.controller.ts:23-32,50-59`). **Fix:** `$transaction`/advisory lock or lease-table `ON CONFLICT`, retry on `P2002`, map errors to 4xx/503.

**H8 — Revocation and `isEnabled` are dead controls.** `isEnabled` is write-only across the entire repo (grep: only `vpn.service.ts:70,80`, both set `true` — connect **re-enables** admin-disabled peers); `revokeDevice` (`admin.service.ts:163-170`) only deletes the `Device` row — the peer survives (`SetNull`, `schema.prisma:87`) with sessions still open, and nothing ever calls the daemon to remove the peer. **Fix:** enforce `isEnabled` on connect, disable peers on revoke, close active sessions, call daemon `/peers/remove`.

**H9 — Address-pool exhaustion DoS + fabricated lease.** `vpn.service.ts:129,140,147-182`: IPs are never released on disconnect, `leaseExpiresAt` is invented client-side and never persisted (grep-verified), no per-user caps, no rate limiting on connect. One authenticated user looping connect with fresh keypairs permanently consumes the /24. **Fix:** persist + enforce the lease with a sweeper, cap peers/sessions per user, rate-limit connect.

**H10 — Daemon trust boundary broken (escalates to Critical when stubs go live).** `vpn-daemon/main.go:127-161`: `/peers/register` & `/peers/remove` have **zero authentication** (no shared secret/mTLS — default is a world-usable Unix socket); `:167-183`: opt-in TCP mode binds `0.0.0.0`; `:173`: nil-pointer panic (`listener.Addr()` before the `err` check); `:74-93`: no validation of `publicKey`/`assignedIp`/`role`/policy fields that are destined to become `wg`/`nft` arguments. Today's exposure is unauthenticated log injection/DoS; **the moment the log-only stubs become real `exec.Command` calls this is unauthenticated firewall-control.** Same pattern mirrored in `scripts/mock-agent.js`. **Fix:** authenticate daemon callers (socket permissions or bearer/mTLS), bind TCP fallback to loopback or delete it, fix the panic, validate all fields, and do not enable `exec` before all of the above.

**H11 — MFA-bypassing mock login compiled into the production bundle.** `Rain/portal/src/App.tsx:156-171`: any API error (including 5xx/non-JSON — line 155 throws) falls into the mock branch, which accepts demo accounts with the committed password; `:184-203`: the mock OTP path **never reads the entered code**, and unknown usernames default to `role: 'ADMIN'`. No `import.meta.env.DEV` gate; the error toast advertises the credentials. Grants a fabricated admin session (real API calls still fail → feeding H12), but it is a shipped MFA bypass and credential disclosure. **Fix:** gate all mock paths behind `import.meta.env.DEV`; never fall back from `catch` to a logged-in state.

**H12 — Admin mutations fabricate success.** `AdminPanel.tsx:202-227` (revoke), `:237-291` (create user), `:304-325` (delete policy), `:327-386` (create policy): `if`/`else` branches show the **identical success toast**; failures and network errors append fabricated local records with fake ids (`u-${Date.now()}`) that later 404 on delete. Operators believe devices are revoked when they are not. **Fix:** check `res.ok && json.success`, show server errors, update state only on success.

**H13 — Fabricated data rendered as real.** `AdminPanel.tsx:409-520`: all six `useQuery` hooks fall back to `MOCK_DEVICES/SESSIONS/LOGS/VERSIONS/USERS/POLICIES` — **even when the API succeeds but returns an empty table** (`json.data?.length > 0` guard). Stats mix mock and real values (`:523-529`). Admins make zero-trust decisions on fabricated users, devices, policies, and audit logs. **Fix:** error/empty states; mock data only behind `DEV`.

**H14 — Supply-chain: silent lockfile fallback.** `npm ci || npm install` in `.github/workflows/ci.yml:39`, `Sobree/api/Dockerfile:13`, `Rain/portal/Dockerfile:10`. CI and images can be built from a dependency graph that does not match the integrity-pinned lockfile. **Fix:** `npm ci` alone; fail loudly.

**H15 — Docker deployments are broken by a build-time env bug.** `App.tsx:18` inlines `import.meta.env.VITE_API_URL` **at build time**, but `Rain/portal/Dockerfile` has no `ARG`/`ENV` for it, so the bundle always ships the `http://localhost:4000` fallback; the Compose runtime env (`docker-compose.yml:85`) has no effect. Every deployed browser calls its own localhost → login fails → flows into the H11 mock path. **Fix:** `ARG VITE_API_URL` + `ENV` before the build step, pass via `build.args`. **[NEEDS-VERIFY]** `grep -l 'localhost:4000'` inside the built image.

**H16 — Dishonest connection state.** `App.tsx:261-282`: `/disconnect` result is never checked for `res.ok` (a 500 still shows "disconnected"); the connect `catch` unconditionally resets to `disconnected` even if the agent succeeded. UI can say "disconnected" while the tunnel routes traffic. **Fix:** check `res.ok`, reconcile from `GET /status` after every transition.

**H17 — Sign-out leaves credentials and cached data behind.** `App.tsx:285-294` clears `authData` but never `username`/`password` (pre-filled defaults persist in the form), never clears the React Query cache, and query keys (`['admin','devices']` etc., `AdminPanel.tsx:409-520`) are not user-scoped — on a shared workstation the next user sees the previous admin's cached tables within the 5-minute `gcTime`. **Fix:** `queryClient.clear()` on sign-out, user-scoped keys, reset the form.

---

## 4. Medium Findings

### Authentication & API surface
- **User enumeration via timing** — `auth.service.ts:36-40` returns before `bcrypt.compare` for unknown/inactive users; known users pay the bcrypt cost. Fix: dummy compare.
- **Stale role claims, no revocation** — `auth.middleware.ts:34-35` trusts the token payload; disabled/demoted users keep rights until expiry; `refreshToken` (7d) is issued but no refresh/rotation/revocation endpoint exists.
- **CORS `origin: true` + `credentials: true`, no helmet** — `server.ts:18-23`; no security-header plugin anywhere.
- **Raw `err.message` returned to clients** — `vpn.controller.ts:23-32,50-59`, every `admin.controller.ts` catch block (Prisma internals leak), plus string-matching on error text (`admin.controller.ts:149-151,236-238`).

### VPN module & data layer
- **`connect` never checks `user.isActive`** and re-derives nothing from the DB (`vpn.service.ts:98-107`).
- **No input validation** — `publicKey` only presence-checked; `bytesRx/Tx` client-asserted into `BigInt()` (throws → 500); no JSON schema on any route (`vpn.routes.ts`).
- **No transaction across the 4 writes**; no unique constraint for "one open session per peer"; repeated disconnects re-stamp `disconnectedAt` and **overwrite** byte counters (`:153-175`) — tamperable telemetry; always returns `success: true`.
- **A new `Device` row per connect** (`:44-55`) — no uniqueness on `(userId, macAddress)`, `lastSeen` never updated.
- **Schema integrity gaps** (`schema.prisma`): user deletion cascades through `VpnPeer` to `VpnSession` destroying session history (`:86,107`) while `AuditLog` survives (`SetNull`, `:144`); no index on `disconnectedAt`; no unique tuple on `VpnPolicy (roleId, cidr, proto, port, action)`.
- **`WG_SERVER_PUBLIC_KEY` placeholder is not a valid Curve25519 key** and DNS includes public `1.1.1.1` (`vpn.service.ts:9,137`, `docker-compose.yml:65`) — metadata leak + handshake can never work with defaults.

### Admin package
- **Zero audit logging on admin mutations** (grep-verified: the only 5 `auditLog.create` calls are in auth/vpn services) — user/policy/device changes leave no trail, despite `schema.prisma:134` calling AuditLog the "Immutable Security Activity Trail".
- **Unbounded queries** — `getUsers`, `getPolicies`, `getAgentVersions` have no `take` (`admin.service.ts:62,78,149`).
- **No runtime validation of `roleName`/policy fields** — `CreateUserDto`/`CreatePolicyDto` types are compile-time only; CIDR/protocol/portRange/action reach the DB unchecked (and feed future nftables rules).
- **Seed non-idempotency/clobbering** — policies are plain-`create`d each run (`seed.ts:60-65`) duplicating rules; the user upsert **resets passwords/roles** on every re-seed (`:94-104`).
- **Two extra `PrismaClient` instances** (`admin.service.ts:5`, `seed.ts:4`) beside the shared one.
- **`metadataJson` returned unredacted** (`admin.service.ts:142`) — including auth `challengeId`s.

### Portal
- **Dev affordances in the production build** — one-click demo buttons, "auto-fill 123456", hardcoded admin email, hints to run `npm run mock:agent` (`LoginForm.tsx:101-143,239,247`, `OtpModal.tsx:205-215`, `App.tsx:168,234`).
- **Fabricated status UI** — endpoint always `vpn.mangovpn.internal:51820`, fake IP `10.13.13.45/32`, static public key, fake `[ OK ]` log lines, "Enforced (SMS)" labels (`VpnDashboard.tsx:202-313`, `AdminPanel.tsx:1026`).
- **UI-only RBAC** — screens gate on `activeTab` alone; all six admin queries fire for every role with no `enabled` flag (`App.tsx:405-526`, `AdminPanel.tsx:402-520`).
- **`expiresIn` ignored, refresh token unused, no logout endpoint call, no idle timeout** (`App.tsx:36,220,285-294`); sign-out during `connecting` can leave the tunnel up.
- **No fetch timeouts/AbortController anywhere; polls every 1.5–5 s with no in-flight guard** (`App.tsx:72-134`).
- **`javascript:` URLs possible in agent download links** (`AdminPanel.tsx:948-951`).
- **OTP input editing bug** — clearing a digit collapses positions (`OtpModal.tsx:52-58,82-85`).
- **No CSP/security headers** (portal nginx config, `Dockerfile:19-26`); dev server on `0.0.0.0` (`vite.config.ts:12-15`); whole-workspace `COPY Rain` with no `.dockerignore`; React 18 while all docs claim React 19 (`package.json:15-16` vs `README.md:31`).

### Go systems
- Private key not zeroed on disconnect; keypair reused across sessions (`agent-windows/main.go:130,167-186`).
- No graceful HTTP shutdown on service stop; no HTTP timeouts on the daemon; signal handler `os.Exit(0)` with no cleanup of peers/nftables state (`vpn-daemon/main.go:191-199`).
- `-debug` flag can silently detach the agent from the service manager (`agent-windows/main.go:242-245`).

### Infrastructure & CI
- **Unpinned images** — `linuxserver/wireguard:latest`, `node:20-alpine`, `nginx:alpine` (`docker-compose.yml:23`, both Dockerfiles).
- **`SERVERURL=127.0.0.1` / `WG_SERVER_ENDPOINT=127.0.0.1:51820`** inside containers (`docker-compose.yml:36,66`) — remote clients would be pointed at their own loopback; tunnels cannot establish.
- **No resource limits, `cap_drop`, `no-new-privileges`, `read_only`, or healthchecks** for `api`/`portal`/`vpn-gateway`; `portal` uses bare `depends_on` (`:76-89`).
- **CI has no `permissions:` block** (`.github/workflows/ci.yml`), pins first-party actions to mutable `v4` tags, shares the weak DB password, and its `lint-and-typecheck` job **never lints** — `npm run lint` is a documented, CI-present **silent no-op** (the only lint script is the root `--if-present` dispatcher; no workspace defines one, no ESLint exists anywhere).
- **Docs overclaim enforcement** — `README.md:52,141-143` and `PROGRESS.md:36` describe `wg set`/nftables/agent-handshake steps that are log-only stubs (see C3).
- **Vestigial `pnpm-workspace.yaml`** with no `pnpm-lock.yaml` — ambiguous package manager; the `Sobree/*` glob also matches non-package dirs.

---

## 5. Low & Informational

- **No `go.sum` in either Go module** — dependency integrity unpinned; `vpn-daemon/go.mod` declares an unused `golang.org/x/sys`; ignored `json.NewEncoder` errors; public keys/IPs logged in the daemon.
- **`PROGRESS.md` is untracked** (`?? PROGRESS.md`) while claiming to track `main@9562c53` — the status artifact isn't versioned with the code it describes.
- **Doc drift:** `QUICKSTART.md:17` points to non-existent `apps/agent-windows`/`services/vpn-daemon` paths; `README.md:14-20` uses machine-absolute `file:///e:/...` links; UI text says 8-char minimum while the schema enforces 6 (`LoginForm.tsx:212` vs `auth.schema.ts:17`); `PROGRESS.md:100` presents the no-op lint as verification.
- **Build/deploy hygiene:** no `.dockerignore` anywhere (build context ships `.git`, local `node_modules`); API runtime image includes devDependencies (`Sobree/api/Dockerfile:27`); Compose overrides the Dockerfile's `NODE_ENV=production` back to `development` (`docker-compose.yml:58`), enabling Prisma query logging; `check:env` trains `-ExecutionPolicy Bypass`; npm cache usable as a same-repo poisoning vector.
- **Seed integrity:** the agent installer `checksumSha256` is the SHA-256 of the **empty string** (`seed.ts:115`) — false integrity metadata. (Also independently found by the orchestrator.)
- **Portal quality:** dead `Header.tsx` (never imported); OTP countdown hardcoded to 272 s; `alert()`/`confirm()` dialogs; `as any` casts; ids not `encodeURIComponent`d; missing label/a11y wiring (`htmlFor`, `aria-label`, `role="dialog"`, focus traps); `lang="en"` on Thai UI; no tests and no lint config.
- **Ops:** `request.ip` used for audit without `trustProxy`; free-form `action` strings drift from schema comments (`VPN_CONNECT` vs `VPN_TUNNEL_CONNECTED`); IPAM never allocates `.2–.9`/`.251–.254`; local `Rain/portal/dist/` contains the committed password string (untracked — do not publish, regenerate in CI).
- **Info:** portal tokens live in memory only; token sent only to the API and the loopback agent; `backendUrl` is accepted but unused — allowlist it when implemented.

---

## 6. What Was Done Well

- **Crypto primitives are correct:** bcrypt (cost 10) for passwords; `crypto.randomUUID()` challenge IDs; 5-minute OTP expiry with single-use consumption; `crypto/rand` Curve25519 keygen with proper clamping (`agent-windows/main.go:47-61`); private key excluded from JSON (`json:"-"`) and never logged; only *public* keys stored in the DB.
- **The one DB invariant that matters holds:** `publicKey` and `assignedIp` are `@unique` (`schema.prisma:80-81`) — the only thing preventing duplicate-IP corruption under the racing allocator.
- **Daemon exec pattern is safe by construction:** `exec.Command` with argument arrays, never a shell (`vpn-daemon/main.go:45-52`); the agent binds loopback only with HTTP timeouts; the daemon defaults to a Unix socket.
- **VPN routes are genuinely guarded** (`authenticate` preHandler + controller re-check), unlike the admin routes.
- **Portal has no XSS sinks** (no `dangerouslySetInnerHTML`/`innerHTML`/`eval`), Zod validates login/OTP input, tokens never touch `localStorage`, and lists use stable server ids as React keys.
- **Git hygiene is clean:** no `.env`, no `node_modules`, no build artifacts or binaries tracked; `.gitignore` covers keys, `*.conf`, and local overrides. The npm lockfile is v3, consistent across all four workspaces, with registry integrity hashes.
- **CI is restrained:** `pull_request` (not `pull_request_target`), first-party actions only, no secrets in workflow env; Postgres has a healthcheck and the API waits on `condition: service_healthy`; the documented 8-table schema claim is true, and all documented npm scripts exist (the lint no-op excepted).

---

## 7. Documentation Integrity Notes

| Claim | Reality |
|---|---|
| "Dynamic `wg set` & role-based forward filter rules" (`README.md:52`) | Log-only stubs; `executeCommand` never called (C3) |
| Backend "registers peer (`wg set`), configures `nftables`" (`README.md:141-143`) | API never contacts the daemon (C3) |
| Agent "activates WireGuard interface" (`PROGRESS.md:85-`) | `time.Sleep` + hardcoded IP stub (`agent-windows/main.go:144-156`) |
| "React 19 + Vite" (`README.md:31`) | React `^18.3.1` (`Rain/portal/package.json:15-16`) |
| `npm run lint` as a verification command (`PROGRESS.md:100`, CI job name) | Silent no-op; no ESLint exists anywhere |
| QUICKSTART Go paths `apps/agent-windows`, `services/vpn-daemon` (`QUICKSTART.md:17`) | Paths do not exist (`Sobree/*`) |
| `PROGRESS.md` "Current Branch: main (9562c53)" | HEAD is `9562c53`, but the file itself is **untracked** |
| "8-table Prisma schema" | ✅ Accurate (8 models verified) |

---

## 8. Recommended Runtime Verification Tests (staging only)

1. **Token forgery (C1):** locally sign an HS256 token with `'mango-vpn-jwt-insecure-secret-key-32chars'` and `role: "ADMIN"`, then call `POST /api/vpn/connect` — expect success.
2. **PNA CSRF (C2):** from any non-portal origin, `fetch('http://127.0.0.1:47821/disconnect', {method:'POST'})` — expect 200.
3. **Admin wiring (H5):** `curl` matrix on `/api/devices`, `/api/audit-logs`, `/api/agent-versions` with no token / ADMIN token / CLIENT token — confirm fail-closed set and the open `agent-versions`.
4. **IPAM race (H7):** ~20 concurrent connects with distinct keys — expect sporadic 500s containing Prisma error text.
5. **OTP brute force (H2):** repeated invalid OTPs on one challenge — confirm no lockout.
6. **Pool exhaustion (H9):** loop connect with fresh keypairs until "IPAM address pool exhausted".
7. **Daemon TCP (H10):** `USE_TCP=true` + `curl -X POST http://<host>:50051/peers/register` from a second host.
8. **Container caps (C4):** `docker compose config` for `SYS_MODULE`/`lib/modules`; in-container `modprobe -n`.
9. **Portal bundle (H15):** `grep -l 'localhost:4000'` in the built portal image assets.

---

## 9. Remediation Roadmap

### P0 — Blockers (before any shared deployment)
1. **Secrets (C1):** rotate `JWT_SECRET`/`REFRESH_SECRET`; delete fallbacks and compose literals; fail-fast at boot; import `dotenv`; pin verify algorithm.
2. **Agent (C2):** origin allowlist; authenticate `/disconnect`; validate tokens on `/connect`; no state change without verified token.
3. **Policy engine (C3):** `ALLOW`-only mapping, DENY exclusions, fail-closed defaults; wire the daemon into connect/disconnect with rollback; only then enable `exec`.
4. **Daemon (H10):** authenticate callers, loopback-only TCP (or none), fix the nil panic, validate all fields — *mandatory before enabling `wg`/`nft` execution*.
5. **Credentials (H1–H3):** remove OTP logging; CSPRNG + attempt limits + rate limiting; eliminate `MangoVPN2026!` everywhere; random per-user passwords forced to rotate.
6. **Admin routes (H5):** `authenticate` + `requireRole` preHandlers; fix the dead admin console; intentionally scope `agent-versions`.
7. **Portal truth (H11–H13):** gate every mock path behind `DEV`; honest success/error/empty states; remove credential pre-fill and hints.
8. **Containers (C4, H4, H14):** drop `SYS_MODULE`/module mount; pin digests; unpublished/loopback DB port with required password; `npm ci` without fallback; `NODE_ENV=production`.
9. **Vite config (H15):** `ARG VITE_API_URL` in the portal Dockerfile + `build.args`.

### P1 — Hardening (next sprint)
IPAM transaction/lock + retry + error mapping; peer ownership checks; enforce `isEnabled` + real revocation (disable peer, close sessions, daemon remove); lease persistence + sweeper + per-user caps + connect rate limiting; `isActive` re-check + server-derived role; admin audit logging on all mutations; runtime input validation (Fastify schema/zod) for auth/vpn/admin routes; transactions for multi-write flows; unique open-session index; CORS allowlist + helmet; sign-out cache/form reset; `res.ok` checks + `/status` reconciliation; fetch timeouts; CSP headers; CI `permissions: contents: read` + SHA-pinned actions + a real lint setup; resource limits + healthchecks for all services.

### P2 — Quality & docs
Documentation truth pass (enforcement claims, React version, QUICKSTART paths, relative links, commit `PROGRESS.md`); delete `pnpm-workspace.yaml` or commit a pnpm lockfile; `go mod tidy` + commit `go.sum`; `.dockerignore`; prune devDeps from runtime images; portal a11y + dead code + OTP input fix; tests (none exist anywhere) — prioritizing the policy engine and IPAM; secret-scanning denylist for `MangoVPN2026!`.

---

## Appendix A — Methodology & Model Usage

The audit ran as six parallel read-only sub-agents, each on a distinct model (per the requested priority order `dot-blue` → OpenCode free → OpenCode Go), with the orchestrator (GLM-5.3) re-verifying every Critical/High finding at the cited source lines:

| Workstream | Scope | Model | Outcome |
|---|---|---|---|
| W1 Auth/MFA/JWT | auth module, middleware, server wiring | `psu-dot-blue/gpt-6-luna` | ✅ complete |
| W2 VPN/IPAM/policy | vpn module, schema, data layer | `psu-dot-blue/glm-5.3` | ✅ complete |
| W3 Go daemons | agent-windows, vpn-daemon, mock agent | `psu-dot-blue/qwen3.7-plus` | ✅ complete |
| W4 Portal frontend | Rain/portal (18 files) | `psu-dot-blue/claude-haiku-5.5` | ✅ complete |
| W5 Admin CRUD & seed | Rain/admin | `psu-dot-blue/glm-5` | ✅ complete |
| W6 Infra/CI/docs | compose, CI, scripts, deps, docs | `psu-dot-blue/deepseek-chat` → **errored** (stream ended without finish_reason) → retried on `opencode/big-pickle` | ✅ complete (Tier-2 fallback) |

- ~100 raw findings were deduplicated into the consolidated list above. Cross-agent corroboration was strong: the JWT secret was independently reported by 4 agents, the default password by 4, the unguarded admin routes by 4, the PNA reflection by 3, the `npm ci` fallback by 2.
- **Verification:** 100% of Critical and High claims were re-checked against source by the orchestrator (files read in full: both `main.go`s, `auth.service.ts`, `auth.middleware.ts`, `server.ts`, `vpn.service.ts`, `vpn.controller.ts`, `vpn.routes.ts`, `schema.prisma`, all four admin files, `App.tsx`, `LoginForm.tsx`, `AdminPanel.tsx` (key ranges), both Dockerfiles, `ci.yml`, `docker-compose.yml`, `mock-agent.js` (key ranges)); plus greps for `dotenv`, `isEnabled`, `leaseExpiresAt`, `auditLog.create`, auth-hook registrations, and lint scripts.
- **No modifications** were made to the repository; the only filesystem action was writing this report file.

## Appendix B — Severity Reconciliations

| Finding | Agent ratings | Final | Rationale |
|---|---|---|---|
| Admin routes w/o auth | W5 Critical · W2 High · W1 Medium | **High** | Currently fail-closed (handlers reject unset `request.user`); only `agent-versions` is truly open; but console is dead for real admins and the pattern is one refactor from open exposure |
| Daemon unauth + `0.0.0.0` | W3 Critical | **High** (escalates to Critical) | `wg`/`nft` calls are log-only stubs today; becomes unauthenticated firewall control the moment exec is enabled |
| Mock login in prod bundle | W4 High | **High** | Bypasses MFA in the UI and leaks credentials, but produces a mock session; backend still enforces on real endpoints |
| `SYS_MODULE` container | W6 Critical | **Critical** | Standard rating for host-kernel-module capability + unpinned image on the shipped deployment artifact |
| Committed JWT secrets | W1/W2/W6 Critical | **Critical** | Directly exploitable as shipped; compose hardcodes the literal |

## Appendix C — Coverage Summary

Backend (13 files), admin package (7), portal (18), Go daemons (4), shared contracts, docker-compose, both Dockerfiles, CI workflow, both scripts, root/workspace package manifests + lockfile spot-checks, `.gitignore`, and the four primary Markdown documents. Not covered: `node_modules` internals, generated Prisma client, runtime behavior (no servers were started — see §8 for staging tests), and the untracked local `dist/` beyond a secret-string scan.

---

*Report generated 2026-11-19 by the audit orchestrator (GLM-5.3) with sub-agents as listed in Appendix A. Read-only audit: repository contents unchanged.*
