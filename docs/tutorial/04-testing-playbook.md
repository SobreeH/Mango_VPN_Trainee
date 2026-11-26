> 🌐 **Language / ภาษา**: **English** | [🇹🇭 ภาษาไทย](th/04-testing-playbook.md)

> 🏠 [Tutorial index](../../TUTORIAL.md) › [00 Overview & Setup](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · **04 Testing** › [05 Troubleshooting](05-troubleshooting-and-reference.md) · [06 Appendix](06-appendix-local-docker-smoke-test.md)

---

# 04 · Step-by-Step Testing Playbook

This chapter is the interactive part: Missions 1 to 4 in the portal, then the gateway inspection and automated checks. Finish [chapter 01](01-track-a-local-dev.md) first (Track A) or the matching setup chapter for Tracks B and C.

The portal defaults to **Thai (`TH`)**. Use the **language toggle** (`EN` / `TH`) to switch to English, and the theme toggle for light or dark mode. This handbook uses English labels.

On the **Admin dashboard**, the left sidebar groups navigation into three collapsible sections:

- **VPN & Live Monitoring:** **VPN Connect**, **Sessions**
- **Management:** **Users**, **Devices**, **Policies**, **Gateways**
- **Audit & System:** **Audit Logs**, **Agent Versions**

Above the active tab, four KPI cards (**Total Users**, **Devices**, **Active Sessions**, **Security Posture**) summarize system state. They are hidden on **VPN Connect** for a cleaner layout.

---

## 🎯 Mission 1: First sign-in and TOTP authenticator setup

1. Open `http://localhost:3000`. Enter username `admin` and the password you set during seeding, then click **Sign In**.

   **What you should see:** A **Set Up Authenticator** screen on first sign-in. If the account already enrolled TOTP, you see **Two-Factor Verification** instead.

2. On first enrollment, scan the QR code with Google Authenticator, Microsoft Authenticator, Authy, or another compatible TOTP app. You can also enter the displayed Base32 key manually. Keep the key private; it can generate your sign-in codes.

   **What you should see:** The app creates a rotating six-digit code for MANGO VPN.

3. Enter the current code in **6-Digit Code**, then click **Verify**. If the code rolls over while you type, wait for the next one and enter it promptly.

   **What you should see:** The Admin dashboard. The sidebar footer shows `admin` and the `ADMIN` role, the KPI cards appear at the top, and **Audit Logs** is selected by default.

---

## 🎯 Mission 2: Pair the local agent and connect to the VPN

1. Click **VPN Connect** in the sidebar under **VPN & Live Monitoring**. In the agent card, check that the agent is reachable. For the mock, it should say **Agent Reachable (Unpaired)** and show version `v2.0.0`. Paste the copied `PairingToken` (or your chosen Go-agent token) into **Agent Pairing Token** (placeholder **Paste X-Mango-Agent-Token**), then click **Pair Agent**.

   **What you should see:** **Agent Paired & Ready**, `Tunnel State: disconnected`, a **VPN Provider** selector (default `WireGuard (Default)`, with a refresh button for registered gateways), and a **Connect VPN** button. If pairing fails, confirm the token exactly matches the running agent.

2. Click **Connect VPN**. The portal requests a single-use ticket that is valid for 60 seconds. The agent creates a fresh Curve25519 keypair in memory and presents the ticket and public key to the API. The API allocates the first free IP (normally `10.13.13.2`) and asks the gateway to add the peer and its role policies. With the Go agent, the agent then activates WireGuard. The mock only simulates the agent state.

   **What you should see (mock demo):** The card turns green as **connected**, with an interactive three-hop **Network Topology** view, **Assigned VPN IP** (`10.13.13.2`), **Active Role** (`ADMIN`), **Protocol Status** (`WireGuard`), live **Data Usage** counters, **Permitted Networks** (click **Technical Details** to see the `Curve25519 Key` and `Protocol`), and a **Disconnect** button.

   For a real tunnel (Tracks B and C), you should also see the `mango0` interface on your host: a WireGuard tunnel service on Windows, or `wg show mango0` on Linux. The mock's displayed state and counters are **not** proof of real WireGuard traffic.

---

## 🎯 Mission 3: Test every Admin governance tab

Audit Logs is active by default. Work through the tabs in the order below so you create data first, then inspect the audit history last.

### 1. Users

1. Click **Users**. Under **Create User**, enter username `staff01`, email `staff01@mangovpn.local`, password `StaffTestPass#2026`, and role `STAFF`. Click **Create User**.
2. Create another user: username `client01`, email `client01@mangovpn.local`, password `ClientTestPass#2026`, role `CLIENT`. Click **Create User**.
3. Find `client01` in the list. Click **Disable**, wait for the status to change to `Disabled`, then click **Enable**.

**What you should see:** Both users appear with their selected roles. `client01` changes from `Active` to `Disabled` and back to `Active`. Admin-created passwords must be at least 12 characters.

### 2. Policies

1. Click **Policies**. Under **Create Zero-Trust Policy**, create Policy 1:

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

2. Create Policy 2:

   | Field | Value |
   |---|---|
   | Policy Name | `Block Admin Subnet` |
   | Role | `CLIENT` |
   | Target CIDR | `10.99.0.0/24` |
   | Protocol | `ANY` |
   | Port Range (TCP/UDP) | Leave blank |
   | Action | `DENY` |
   | Priority | `50` |

   Click **Create Policy**. A port range applies only to TCP or UDP, so leave it blank for `ANY`.

**What you should see:** Both policies appear with the correct role, CIDR, action, protocol, and priority. You can also try the **Search** box and the **Role** and **Action** filters. Optional: create a throwaway policy, click its **Delete** button, and confirm it disappears without an error.

### 3. Gateways

Click **Gateways** under **Management**.

**What you should see:** The seeded `Primary WireGuard Gateway` (`WIREGUARD`, `10.13.13.0/24`, `API_MANAGED`, `Default`). Optional: register an extra gateway (`WIREGUARD`, `FORTINET`, or `CISCO`), filter by provider or search term, toggle enable or disable, or delete a test gateway.

### 4. Agent Versions

1. Click **Agent Versions**. Under **Publish Agent Version**, enter:

   | Field | Value |
   |---|---|
   | Version | `2.0.0` |
   | Platform | `windows-x64` on Windows, or `linux-x64` on Linux (must match your client OS) |
   | Download URL | `https://downloads.mango.local/mango-agent-2.0.0.exe` |
   | SHA-256 Checksum | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

   **Platform must match your client OS.** Both `Sobree/agent-windows` and `scripts/mock-agent.js` detect the host OS (`windows-x64` on Windows, `linux-x64` on Linux) unless you set `AGENT_PLATFORM`. A version published for the wrong platform will not match. On Linux, use `linux-x64` with a matching URL and checksum.

2. Check **Minimum required version**, then click **Publish Version**.

   **What you should see:** Version `2.0.0` appears as Active and Required. The URL is a sample registration value, not a real download location.

3. **Optional enforcement test (careful):** Disconnect the VPN if connected. Publish version `2.1.0` for your platform with a valid URL and a 64-hex checksum, and check **Minimum required version**. On the agent card, click **Connect VPN** again.

   **What you should see:** The API rejects the agent's `2.0.0` version with HTTP `426` and `AGENT_VERSION_OUTDATED`. In **Agent Versions**, click **Mark Optional** on `2.1.0`, and the `2.0.0` agent can connect again. Alternatively, **Deactivate** on the `2.1.0` record blocks that exact version. Do not deactivate `2.0.0` by mistake.

### 5. Devices

Click **Devices**.

**What you should see:** A summary strip (**Total**, **Active**, **Revoked**), search and status filters, **Refresh**, and **Export CSV**. Your connected machine appears with an OS icon, hostname, device fingerprint, user `admin`, last-seen timestamp, and status `ACTIVE`. Click **Inspect** for device details. The mock fingerprint is generated from the hostname unless you set `AGENT_DEVICE_FINGERPRINT`.

### 6. Sessions

Click **Sessions**.

**What you should see:** A live `ACTIVE` session for `admin`, normally with assigned IP `10.13.13.2`. The view has an **Auto 5s** auto-refresh toggle, **Refresh**, **Export CSV**, search and status filters (`ALL`, `ACTIVE`, `DISCONNECTED`, `EXPIRED`), a per-row **Disconnect** action, and an emergency **Terminate All Active** button.

### 7. Audit Logs

Click **Audit Logs**. Look for security events from the actions above, such as `VPN_TICKET_ISSUED`, `VPN_CONNECTED`, `USER_CREATED`, `POLICY_CREATED`, and an agent-version creation event (shown by the API as `agent_version.create`). Try the **Action filter**, **Target type filter**, and **Search** boxes. For example, search for `admin` or filter by `USER_CREATED`.

**What you should see:** Recent events in a timestamped table. Click **Inspect** to open an event's audit payload, and **Close** to dismiss it. An empty result is shown honestly as `No audit logs found.`

---

## 🎯 Mission 4: Real-time revocation and non-admin RBAC (`STAFF` sign-in)

You can test every role on the single portal URL (`http://localhost:3000`) by signing out and back in. In development the portal sends `X-Mango-Dev-User`, and `scripts/mock-agent.js` keeps each user's agent state and device fingerprint separate (`-<username>`).

1. As `admin`, click **Sessions**, then click **Disconnect** on the active session.

   **What you should see:** The session changes to `DISCONNECTED`, and the gateway removes its peer. For the mock, the local card may still show its previous state until you click **Disconnect VPN** or restart the mock. Admin disconnection removes the server-side peer. It does not push a state change into the agent process.

2. **Device revocation is permanent for that fingerprint.** Clicking **Revoke** in **Devices** blocks that fingerprint from reconnecting. Leave your main demo device active unless you specifically want to test this. To use a fresh mock identity instead, stop the mock with `Ctrl+C`, set a new fingerprint, and restart it:

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

   **What you should see:** A new mock startup box with a new `PairingToken:`. Pair with that token. If you revoked `mock-device-02` earlier, choose another unused fingerprint. Clear the variable afterwards with `Remove-Item Env:AGENT_DEVICE_FINGERPRINT` (PowerShell) or `unset AGENT_DEVICE_FINGERPRINT` (Bash).

   **Per-user fingerprint isolation (mock agent):** `scripts/mock-agent.js` builds the fingerprint from the base value (`AGENT_DEVICE_FINGERPRINT`, or a hash of the hostname) and **appends `-<username>`** when the portal sends `X-Mango-Dev-User`. Each of `admin`, `staff01`, and `client01` therefore gets its own agent state and device identity. The Go agent does **not** add this suffix. With the Go agent, set a different `AGENT_DEVICE_FINGERPRINT` per user instead (see step 4).

3. Before switching users, disconnect the local agent if it still shows connected. Click **Log Out**, then sign in as `staff01` with `StaffTestPass#2026`. The first sign-in for `staff01` enrolls its own TOTP: scan its QR code (or enter its Base32 key), type the current **6-Digit Code**, and click **Verify**.

   **What you should see:** The Staff sidebar dashboard showing `staff01 · STAFF`, with three tabs: **Connection**, **Profile & Security**, and **Help**. Staff users do not see the **Admin Governance** tabs. Click **Help** to confirm the **Download MANGO Agent Installer** card loads active releases from `GET /api/vpn/agent-versions`, including the `2.0.0` release from Mission 3, with its SHA-256 copy button and download link. If you sign in as `client01`, you see a focused **CLIENT PORTAL** with only the VPN connection card.

4. With the **mock agent**, `staff01` already gets its own fingerprint suffix (`-staff01`), and the pairing token persists in `localStorage`. You may only need to click **Connect VPN**, or pair again if you restarted the mock. To test with an explicit fingerprint instead (or with the **Go agent**, which adds no suffix), set `AGENT_DEVICE_FINGERPRINT` before restarting the agent:

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

   Paste the newly printed token, click **Pair Agent**, then click **Connect VPN**. With the **Go agent**, set `AGENT_DEVICE_FINGERPRINT` the same way before `go run .` (`$env:...` in an Administrator PowerShell, or `export` before `sudo -E go run .`).

   **What you should see:** `staff01` connects as `STAFF`. Because Mission 3 created an `ALLOW` policy for `STAFF`, **Permitted Networks** includes `10.20.0.0/16`. It may list other allowed networks depending on the policy data. The Admin Governance tabs stay hidden. The fingerprint must differ from the one used for `admin`.

---

## Phase 5: Gateway inspection and automated checks

### 5.1 Inspect the Docker gateway while a peer is registered (Tracks B and C only)

Skip this section for Track A. `npm run mock:daemon` runs on your host and has no `wg0` interface or `mango_vpn` nftables table.

With a session connected in Track B or C, run these commands in any terminal. The gateway runs in Docker, so the commands are the same on Windows and Linux:

```bash
docker exec mango-vpn-gateway wg show
docker exec mango-vpn-gateway nft list table inet mango_vpn
```

**What you should see:** `wg show` lists interface `wg0`, the listening port, and a peer with its public key and allowed IPs. The `nft` command prints the `inet mango_vpn` table and its forwarding rules. These commands show gateway configuration. A mock session still does not establish a real client tunnel or prove that traffic flows.

On Linux with a real Go tunnel, you can also inspect the client side with `sudo wg show mango0`. On Windows, use the WireGuard for Windows app to view the `mango0` tunnel.

### 5.2 Probe the local agent

Replace `<your-pairing-token>` with the token printed by the mock, or the value you set for the Go agent. A wrong or stale token returns `401`.

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

**What you should see:** `/health` returns `status` (`ok`), `service`, `version`, `uptimeSeconds`, and the `tunnelActive` boolean. The mock's `/health` also returns `supportsDevUserHint: true`, which the Go agent does not send. `/status` returns the agent state, version, and, when connected, the assigned IP, endpoint, and allowed IPs, plus `bytesReceived` and `bytesSent`. With the mock, the byte counters are simulated. With the Go agent, they reflect the agent's implementation and can remain zero.

### 5.3 Run the automated checks

Run the guardrail scanner from the repository root:

```bash
node scripts/check-guardrails.mjs
```

**What you should see:** `Guardrail check passed (0 violations).`

Build the TypeScript monorepo:

```bash
npm run build
```

**What you should see:** Successful builds for the shared contracts and the applicable workspaces, with zero TypeScript errors.

Before running tests, confirm the `.env` database URL is present. Do not paste its value into a public log or chat.

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

The Vitest suites run across the API, Admin, and Portal workspaces. PostgreSQL must be running and the database must have the current v2 schema. For Track A, that means the embedded instance from `npm run db:start` (keep it running) with `mangovpn_v2_test` migrated as shown in Step A1. If a test expects an exported `DATABASE_URL`, set it for this terminal with the same URL from `.env`, then rerun `npm test`.

**What you should see:** Test suites report passed tests. If tests fail because PostgreSQL is unreachable or the schema is old, use [chapter 05](05-troubleshooting-and-reference.md) before treating the failure as a code defect.

For the Go modules, run these checks from the repository root.

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

**What you should see:** `go vet` and `go test` complete without errors in each module. In PowerShell, keep `Push-Location` and `Pop-Location` paired so the shell returns to the repository root. The Bash `GOOS=windows go vet` line checks that the agent also compiles for Windows.

---

**Next:** [05 Troubleshooting & Reference](05-troubleshooting-and-reference.md) →

> 🏠 [Tutorial index](../../TUTORIAL.md) › [00 Overview & Setup](00-overview-and-setup.md) › [01 Track A](01-track-a-local-dev.md) · [02 Track B](02-track-b-gns3-mock-cloud.md) · [03 Track C](03-track-c-cloud-deployment.md) · **04 Testing** › [05 Troubleshooting](05-troubleshooting-and-reference.md) · [06 Appendix](06-appendix-local-docker-smoke-test.md)
