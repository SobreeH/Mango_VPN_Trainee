# MANGO VPN — Remediation Fix Plan

| | |
|---|---|
| **Companion to** | [AUDIT_REPORT.md](./AUDIT_REPORT.md) (same audit, `main @ 9562c53`) |
| **Purpose** | Orders every audit finding into a dependency-safe, executable fix sequence |
| **How to use** | Work top-to-bottom within a phase. Each item lists the findings it closes, exact files, concrete steps, and an **acceptance check** — tick the box only when the check passes |
| **Severity legend** | `C#` = Critical · `H#` = High · numbers refer to AUDIT_REPORT.md §2/§3; grouped Medium/Low items cite §4/§5 |

> ⚠️ **Two hard safety gates (do not reorder):**
> 1. **F1 before everything** — token-based verification of all later fixes is meaningless while the committed JWT secret is live.
> 2. **Never merge F7 (enable daemon `exec`) before F6 (daemon authentication) is merged and verified.** Until then, the daemon must stay log-only — enabling `wg`/`nft` execution on an unauthenticated daemon turns H10 into unauthenticated firewall control (see report Appendix B).

---

## Progress Dashboard

| Phase | Theme | Items | Closes | Status |
|---|---|---|---|---|
| **0** | Stop the bleed — same-day quick wins | F1–F9 | C1, C4 (partial), H1, H2 (partial), H3 (code), H4, H14 + 2 Medium | ☐ Not started |
| **1** | Structural blockers — P0 | F10–F18 | C2, C3, H5, H10, H11–H13, H15, H7–H9 | ☐ Not started |
| **2** | Hardening — P1 | F19–F25 | Remaining Mediums (auth, VPN, admin, portal, Go, CI) | ☐ Not started |
| **3** | Quality & docs — P2 | F26–F32 | Low/Info findings + doc integrity | ☐ Not started |

---

## Phase 0 — Stop the Bleed (target: day 1, ~1 dev-day total)

Small, independent, high-value changes. No refactoring required.

- [ ] **F1 · Rotate & externalize all signing secrets** *(closes C1)* — effort: S
  - Files: `Sobree/api/src/modules/auth/auth.service.ts:13,15` · `Sobree/api/src/middleware/auth.middleware.ts:17` · `docker-compose.yml:61,63` · `Sobree/api/src/server.ts` (boot check)
  - Steps: delete both fallback literals → fail startup if `JWT_SECRET`/`REFRESH_SECRET` are missing or < 32 random bytes → add `import 'dotenv/config'` (or run with `--env-file`) so `.env` actually loads → remove the literals from compose and source from `${JWT_SECRET:?required}` → pin `{ algorithms: ['HS256'] }` in `jwt.verify` → **rotate the exposed values everywhere they were used**.
  - Acceptance: app refuses to boot without secrets; grep for `mango-vpn-jwt-insecure` and `mango-vpn-refresh-token` returns nothing (repo + compose); a token signed with the old secret is rejected.

- [ ] **F2 · Delete OTP logging** *(closes H1)* — effort: S
  - Files: `Sobree/api/src/modules/auth/auth.service.ts:66-70`
  - Steps: remove the `console.log` that prints username, challengeId, and the live OTP.
  - Acceptance: login flow produces no OTP value in stdout/logs.

- [ ] **F3 · CSPRNG for OTP** *(closes the generation half of H2)* — effort: S
  - Files: `Sobree/api/src/modules/auth/auth.service.ts:55` (`crypto` is already imported)
  - Steps: replace `Math.random()` with `crypto.randomInt(100000, 1000000)`.
  - Acceptance: all issued OTPs come from `crypto.randomInt`; no `Math.random` in the auth module.
  - Note: attempt limits + rate limiting stay in Phase 2 (F19) — until then H2 is only *half* closed.

- [ ] **F4 · Kill the default password in code** *(closes the code half of H3)* — effort: S
  - Files: `Rain/admin/src/seed.ts:67-68,105` · `Rain/admin/src/admin.service.ts:38`
  - Steps: seed password from `process.env.SEED_PASSWORD` (required, no default) → never `console.log` credentials → remove the `MangoVPN2026!` fallback in `createUser` (reject password-less creation instead) → force rotation on first login.
  - Acceptance: `grep -r "MangoVPN2026" src/` is empty in both packages; seeding fails loudly without the env var.
  - Note: the portal-side pre-fill/leak of the same password is handled with the other portal fixes in F12.

- [ ] **F5 · Unpublish & re-credential Postgres** *(closes H4)* — effort: S
  - Files: `docker-compose.yml:7-11,60` · `.github/workflows/ci.yml:18,44`
  - Steps: remove the `5432:5432` host port (or bind `127.0.0.1:5432:5432`) → password from `${POSTGRES_PASSWORD:?required}` → same for `DATABASE_URL` → use distinct throwaway credentials in CI.
  - Acceptance: `docker compose config` shows no `5432` published on non-loopback; compose fails without the env var.

- [ ] **F6 · Drop container escape surface** *(closes C4, keeps the Medium pinning item for Phase 2)* — effort: S
  - Files: `docker-compose.yml:26-28,47,23`
  - Steps: delete `SYS_MODULE` from `cap_add` → remove the `/lib/modules:/lib/modules:ro` mount → pin `linuxserver/wireguard` **by digest** (not `:latest`) → add `cap_drop: [ALL]` + re-add only `NET_ADMIN`, `security_opt: [no-new-privileges:true]`.
  - Acceptance: `docker compose config` contains neither `SYS_MODULE` nor `lib/modules`; `modprobe -n <module>` fails inside the container.

- [ ] **F7 · `npm ci` without fallback** *(closes H14)* — effort: S
  - Files: `.github/workflows/ci.yml:39` · `Sobree/api/Dockerfile:13` · `Rain/portal/Dockerfile:10`
  - Steps: replace every `npm ci || npm install` with plain `npm ci` → regenerate `package-lock.json` deliberately when deps change.
  - Acceptance: grep for `npm ci ||` returns nothing; CI fails on lockfile drift instead of silently regenerating.

- [ ] **F8 · Production mode in compose** *(closes the NODE_ENV Medium)* — effort: S
  - Files: `docker-compose.yml:58`
  - Steps: `NODE_ENV=production` (or `${NODE_ENV:-production}`) — stops dev-mode behaviors incl. Prisma query logging in the containerized stack.
  - Acceptance: `docker compose config` renders `NODE_ENV=production`.

- [ ] **F9 · Stop the agent leaking state to any origin — minimal patch** *(first half of C2, buys time until F10)* — effort: S
  - Files: `Sobree/agent-windows/main.go:64-84` · `scripts/mock-agent.js:50-60`
  - Steps: replace origin reflection with a hard-coded allowlist (`http://localhost:3000`, `http://127.0.0.1:3000` until configurable) → drop `Access-Control-Allow-Credentials` unless a session is actually needed → require a non-empty token on `/disconnect` too (full validation comes in F10).
  - Acceptance: a `fetch` from any non-allowlisted origin gets no CORS grant; `/disconnect` with no token is rejected.

---

## Phase 1 — Structural Blockers / P0 (target: sprint 1)

Order within this phase is dependency-driven. **F10 → F16 → F17 is the critical chain.**

- [ ] **F10 · Agent trust boundary, full fix** *(closes C2 completely)* — effort: M
  - Files: `Sobree/agent-windows/main.go` (`/connect` :112-165, `/disconnect` :167-186, mounting :190-193)
  - Steps: validate the `accessToken` (cryptographically or via a backend verify call) **before any state change** — `/connect` currently accepts any non-empty string and stubs a fake "connected" state (:144) → require the same valid token on `/disconnect` → gate `Access-Control-Allow-Private-Network` on the actual preflight header → make the origin allowlist configurable (portal origins only).
  - Acceptance (report §8.2): `fetch('http://127.0.0.1:47821/disconnect', {method:'POST'})` from a non-portal page fails; `/connect` with a garbage token does not change state.

- [ ] **F11 · Guard the admin API** *(closes H5)* — effort: S–M
  - Files: `Rain/admin/src/admin.routes.ts:7-16` (+ a `requireRole('ADMIN')` helper next to the existing `authenticate` middleware)
  - Steps: attach `authenticate` + `requireRole('ADMIN')` preHandlers to **all** admin routes as a scoped plugin → keep per-handler re-checks as defense-in-depth → decide explicitly whether `GET /api/agent-versions` stays public (if yes, comment why + add rate limit; if no, guard it like the rest).
  - Acceptance (report §8.3): curl matrix — no token → 401; CLIENT token → 403; ADMIN token → 200 on `/api/users`, `/api/policies`, `/api/devices`, `/api/sessions`, `/api/audit-logs`; the admin console becomes *usable* again (it is currently fail-closed dead even for real admins).

- [ ] **F12 · Portal tells the truth** *(closes H11, H12, H13 + H3 portal remnants + H16, H17)* — effort: M
  - Files: `Rain/portal/src/App.tsx` · `Rain/portal/src/components/AdminPanel.tsx` · `LoginForm.tsx` · `OtpModal.tsx`
  - Steps:
    1. Gate **every** mock path behind `import.meta.env.DEV` — the mock login (:156-171) currently ships in the production bundle and falls into it on *any* API error; the mock OTP never reads the entered code and defaults unknown users to `ADMIN` (:184-203).
    2. Make mutations honest (AdminPanel :202-227, :237-291, :304-386): check `res.ok && json.success`, show the server's error, update state only on success — the `if`/`else` branches currently show the *identical* success toast and failures append fabricated rows (`u-${Date.now()}`).
    3. Empty/error states instead of `MOCK_*` fallbacks (:409-520) — the current `json.data?.length > 0` guard renders fabricated data **even on a legitimate empty response**.
    4. Remove the password pre-fill (:33), the credential-advertising error toast (:170), demo buttons and OTP auto-fill hints.
    5. Check `res.ok` on disconnect (:273) and reconcile from `GET /status` after transitions (H16).
    6. On sign-out (:285-294): clear username/password state, `queryClient.clear()`, user-scope the query keys (H17).
  - Acceptance: production build contains no mock data/mock login strings (`grep` in built assets); a stopped API shows error/empty states, never fabricated tables; wrong OTP fails even in dev mock mode.

- [ ] **F13 · Make Docker portal deployments work** *(closes H15)* — effort: S
  - Files: `Rain/portal/Dockerfile` (builder stage) · `docker-compose.yml` (portal `build.args`)
  - Steps: add `ARG VITE_API_URL` + `ENV VITE_API_URL=$VITE_API_URL` **before** the build step (Vite inlines at build time — the current runtime env at compose :85 does nothing) → pass it via `build.args`.
  - Acceptance (report §8.9): `grep -l 'localhost:4000'` finds nothing in the built image's JS assets; a browser on another machine reaches the real API.

- [ ] **F14 · Fix the policy engine (logic only, no daemon calls yet)** *(closes half of C3)* — effort: M
  - Files: `Sobree/api/src/modules/vpn/vpn.service.ts:37-142` (esp. :110-112)
  - Steps: `allowedIps` must map **only `action: ALLOW` policies** → compute DENY exclusions → replace the broad fail-open default (`10.13.13.0/24,10.0.0.0/8`, :11,112) with fail-closed (no policies → no routes) → carry `protocol`/`portRange` through to the returned config so the daemon can enforce them later.
  - Acceptance: unit-test matrix — a role with only a DENY policy gets **no** allowed routes; a role with ALLOW+DENY on overlapping CIDRs gets the difference; zero-policy role gets nothing.

- [ ] **F15 · Peer ownership + revocation become real** *(closes H6, H8)* — effort: M
  - Files: `Sobree/api/src/modules/vpn/vpn.service.ts:73-84,98-107,153-175` · `Rain/admin/src/admin.service.ts:163-170`
  - Steps: on connect, if the `publicKey` already exists require `peer.userId === userId` and validate `deviceId` ownership (public keys are not secrets — the agent prints them, so reassignment currently hijacks the peer) → check `user.isActive` → honor `isEnabled` (connect currently *re-enables* admin-disabled peers at :70,80) → `revokeDevice` must disable the peer, close open sessions, and (after F17) call daemon `/peers/remove`.
  - Acceptance: user B connecting with user A's public key is rejected; a revoked device cannot reconnect; disabled peers stay disabled.

- [ ] **F16 · Harden the daemon — MANDATORY PREREQUISITE for F17** *(closes H10)* — effort: M
  - Files: `Sobree/vpn-daemon/main.go` (`:127-161` handlers, `:167-183` TCP, `:173` panic, `:74-93` validation)
  - Steps: authenticate all `/peers/*` callers (Unix socket permissions by default, or bearer/mTLS) → bind the opt-in TCP fallback to `127.0.0.1` only or delete the mode → fix the nil-pointer panic (check `err` before `listener.Addr()`) → validate `publicKey`/`assignedIp`/`role`/policy fields on entry (they are destined to become `wg`/`nft` arguments) → mirror the auth requirements in `scripts/mock-agent.js`.
  - Acceptance (report §8.7): `USE_TCP=true` daemon reachable only from loopback; `/peers/register` without the shared credential → 401/403; malformed peer payload → 4xx, no panic.

- [ ] **F17 · Wire the control plane to the daemon (only after F16 is merged)** *(closes the other half of C3)* — effort: M–L
  - Files: `Sobree/api/src/modules/vpn/vpn.service.ts` (connect/disconnect) · `Sobree/vpn-daemon/main.go:45-52` (`executeCommand`)
  - Steps: `connect()` calls `/peers/register` and `disconnect()` calls `/peers/remove` (currently the API never contacts the daemon at all — zero references) → on registration failure, roll back the DB rows and return 503 → only then replace the log-only stubs with real `exec.Command` calls (`wg set` / `nft`) → keep the argument-array pattern (`exec.Command` with args, never a shell).
  - Acceptance: connect produces an actual `wg` peer (visible in `wg show`) limited to the ALLOW-only routes from F14; disconnect removes it; a daemon outage fails connect closed (503), never leaves the peer registered.

- [ ] **F18 · IPAM and lease integrity** *(closes H7, H9)* — effort: M
  - Files: `Sobree/api/src/modules/vpn/vpn.service.ts:17-32,129,140,147-182` · `Sobree/api/src/modules/vpn/vpn.controller.ts:23-32,50-59`
  - Steps: allocate inside a `$transaction` with a retry on Prisma `P2002` (the current read-all → pick-first-free → create has a TOCTOU race; the loser gets a raw-`err.message` 500) → persist and enforce `leaseExpiresAt` with a sweeper job (it is currently fabricated client-side and never stored) → release the IP on disconnect → cap peers/sessions per user → rate-limit `/connect`.
  - Acceptance (report §8.4, §8.6): ~20 concurrent connects all succeed with distinct IPs; a looping attacker hits a 429/cap before pool exhaustion; every `err.message` response is replaced by mapped 4xx/503 errors.

---

## Phase 2 — Hardening / P1 (target: sprint 2)

Grouped by area; order within the phase is free. *(These close the Medium findings in report §4.)*

- [ ] **F19 · Auth hardening** — enumeration-safe login (dummy `bcrypt.compare` for unknown users, `auth.service.ts:36-40`) · per-challenge OTP attempt limit + invalidation + per-IP rate limiting (completes H2) · server-side role/`isActive` re-check on authenticated requests (`auth.middleware.ts:34-35` — stale tokens currently keep rights until expiry) · implement refresh-token rotation + revocation endpoint (a 7-day refresh token is issued but nothing consumes it) · CORS allowlist instead of `origin: true` + add `helmet` (`server.ts:18-23`) · stop returning raw `err.message` to clients everywhere (API controllers + admin controller, incl. the string-matching on error text at `admin.controller.ts:149-151,236-238`).

- [ ] **F20 · VPN module data integrity** — runtime input validation (Fastify JSON schema / zod) on all routes: `publicKey` format, `bytesRx/Tx` bounds (currently client-asserted into `BigInt()`), policy CIDR/protocol/port/action fields · `isActive` check inside `connect` · transaction across the 4 writes · unique constraint for "one open session per peer" · stop `disconnect` from overwriting byte counters / re-stamping `disconnectedAt` (tamperable telemetry) · device dedup on `(userId, macAddress)` + `lastSeen` updates · fix `WG_SERVER_PUBLIC_KEY` placeholder (not a valid Curve25519 key) and remove public `1.1.1.1` from client DNS.

- [ ] **F21 · Admin package** — audit-log every admin mutation (currently zero `auditLog.create` calls there, despite the schema calling AuditLog the "Immutable Security Activity Trail") · `take` limits on unbounded queries (`admin.service.ts:62,78,149`) · runtime validation of `CreateUserDto`/`CreatePolicyDto` · seed idempotency: upsert policies (currently duplicated every run, `seed.ts:60-65`) and stop the user upsert from resetting passwords/roles (`:94-104`) · share one `PrismaClient` instance · redact `metadataJson` (leaks auth `challengeId`s).

- [ ] **F22 · Portal robustness** — fetch timeouts/AbortController everywhere (none exist) · remove fabricated status UI (`VpnDashboard.tsx:202-313`: fake endpoint, fake IP, fake `[ OK ]` lines, "Enforced (SMS)") · enforce RBAC server-side AND gate admin queries with `enabled` (currently all six fire for every role) · honor `expiresIn` + idle timeout + call the logout endpoint · safe download links (`AdminPanel.tsx:948-951` allows `javascript:` URLs) · CSP/security headers in the portal nginx config · bind the dev server to loopback (`vite.config.ts:12-15`).

- [ ] **F23 · Go systems** — zeroize the private key on disconnect + stop reusing keypairs across sessions (`agent-windows/main.go:130,167-186`) · graceful HTTP shutdown on service stop · HTTP timeouts on the daemon · signal handler must clean up peers/nftables state instead of `os.Exit(0)` (`vpn-daemon/main.go:191-199`) · make `-debug` unable to silently detach from the service manager.

- [ ] **F24 · CI honesty & least privilege** — `permissions: contents: read` (`.github/workflows/ci.yml` has no permissions block) · pin `actions/checkout`/`setup-node` to commit SHAs · implement a real lint setup (the `lint-and-typecheck` job never lints — `npm run lint` is a documented, CI-present **silent no-op**; no ESLint exists anywhere) or delete the claim from docs/CI.

- [ ] **F25 · Container hardening, remainder** — resource limits + healthchecks for `api`/`portal`/`vpn-gateway`, `condition: service_healthy` for portal's `depends_on` · pin `node:20-alpine` and `nginx:alpine` by digest (the wireguard image was pinned in F6) · fix `SERVERURL`/`WG_SERVER_ENDPOINT` — `127.0.0.1` inside containers points remote clients at their own loopback (`docker-compose.yml:36,66`); make it a required public-host variable.

---

## Phase 3 — Quality & Docs / P2 (target: sprint 3)

- [ ] **F26 · Documentation truth pass** *(closes the doc-integrity table, report §7)* — downgrade the `wg set`/nftables/agent-handshake claims until F17 ships (or point to it as done afterward) · fix "React 19" → 18 (`README.md:31` vs `package.json:15-16`) · fix QUICKSTART Go paths (`apps/agent-windows`/`services/vpn-daemon` don't exist; real: `Sobree/*`, `QUICKSTART.md:17`) · replace machine-absolute `file:///e:/...` links with relative ones · commit `PROGRESS.md` (currently untracked while claiming to track `main@9562c53`) · remove the lint claim from `PROGRESS.md:100` (or make it true in F24) · fix the 8-vs-6 password-minimum doc mismatch.

- [ ] **F27 · Package manager clarity** — delete the vestigial `pnpm-workspace.yaml` **or** make pnpm authoritative (commit `pnpm-lock.yaml`, switch CI/Dockerfiles); today npm is de-facto authoritative with no pnpm lockfile, so a `pnpm install` would fork the dependency graph.

- [ ] **F28 · Go module hygiene** — commit `go.sum` for both modules (dependency integrity currently unpinned) · `go mod tidy` to drop the unused `golang.org/x/sys` · stop logging public keys/IPs in the daemon · handle `json.NewEncoder` errors.

- [ ] **F29 · Build hygiene** — add a root `.dockerignore` (`node_modules`, `.git`, `.env*`, `dist`, `*.log`) — none exists, so build contexts ship `.git` and local `node_modules` · prune devDependencies from the API runtime image (`Sobree/api/Dockerfile:27` currently copies the full tree) · document `check:env` without `-ExecutionPolicy Bypass` · never publish the local `Rain/portal/dist/` (it currently contains the committed password string — regenerate in CI).

- [ ] **F30 · Portal quality** — fix the OTP input editing bug (clearing a digit collapses positions, `OtpModal.tsx:52-58,82-85`) · remove the dead `Header.tsx` · fix the hardcoded 272s OTP countdown · replace `alert()`/`confirm()` · encode ids in URLs · a11y wiring (`htmlFor`, `aria-label`, dialog semantics, focus traps) and `lang="th"` for the Thai UI · remove `as any` casts.

- [ ] **F31 · Tests (none exist anywhere)** — priority order: policy engine (F14 matrix), IPAM allocation/race (F18), peer ownership (F15), auth flows (OTP limits, refresh), admin RBAC (F11 curl matrix as CI integration test) · add lint/typecheck to CI once real (F24).

- [ ] **F32 · Guardrails** — secret-scanning denylist for `MangoVPN2026!` and the old JWT literals (prevents regression) · CI `npm ci` only (already F7 — keep enforced) · consider pre-commit hooks for `.env` files.

---

## Verification Checklist (from report §8 — run in staging after the matching phase)

| Test | Validates | After phase |
|---|---|---|
| Forge HS256 token with old secret → call `/api/vpn/connect` | F1 | 0 |
| `fetch('/disconnect')` from a foreign page against the agent | F9/F10 | 0/1 |
| Curl matrix: no token / CLIENT / ADMIN on all admin routes | F11 | 1 |
| ~20 concurrent connects with distinct keys → distinct IPs, no raw Prisma errors | F18 | 1 |
| Repeated invalid OTPs on one challenge → lockout | F19 | 2 |
| Loop connect with fresh keypairs → per-user cap / 429 before pool exhaustion | F18 | 1 |
| `USE_TCP=true` daemon from a second host → refused; unauth `/peers/register` → 401 | F16 | 1 |
| `docker compose config` → no `SYS_MODULE`/`lib/modules`; `modprobe -n` fails in-container | F6 | 0 |
| Built portal image assets contain no `localhost:4000`, no mock strings | F12/F13 | 1 |
| Connect produces a real `wg` peer limited to ALLOW routes; disconnect removes it | F17 | 1 |

---

## Estimation Summary

| Phase | Rough effort | Findings closed |
|---|---|---|
| 0 — Stop the bleed | ~1 dev-day | 1 Critical + 4 High (full) + parts of C2/C3-adjacent + 2 Medium |
| 1 — Structural P0 | ~5–8 dev-days | 2 Critical + 11 High (full closure of all C/H) |
| 2 — Hardening | ~4–6 dev-days | ~20 Medium |
| 3 — Quality & docs | ~3–4 dev-days | Low/Info + doc integrity |

*Generated 2026-11-19 from [AUDIT_REPORT.md](./AUDIT_REPORT.md). This plan is advisory; it is the only new file added alongside the report.*
