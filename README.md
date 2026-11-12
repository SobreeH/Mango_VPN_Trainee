# MANGO VPN

> A Zero-Trust Role-Based WireGuard Remote Access & Policy Management System.

[English](README.md) | [ภาษาไทย](README.th.md)

MANGO VPN eliminates manual `.conf` file management for corporate VPN users through a centralized Web Portal, a RESTful control plane API, and a custom background Windows Agent service that manages local Curve25519 keys and communicates securely over Chromium Private Network Access (PNA).

---

## 📚 Documentation Index

- **English**:
  - **[🚀 Quick Start & Environment Readiness Guide](file:///e:/Trainee/Mango_VPN_Trainee/QUICKSTART.md)**: Tool prerequisites, verification scripts, and port mapping.
  - **[🌧️ Rain's Development Guide (Junior Dev)](file:///e:/Trainee/Mango_VPN_Trainee/Rain/README.md)**: Web Portal UI & Admin CRUD development.
  - **[⚡ Sobree's Development Guide (Senior Dev)](file:///e:/Trainee/Mango_VPN_Trainee/Sobree/README.md)**: Management API, Go Windows Service, and Linux VPN Daemon.
- **ภาษาไทย**:
  - **[🚀 คู่มือเริ่มต้นด่วน & ตรวจสอบความพร้อมของเครื่องมือ](file:///e:/Trainee/Mango_VPN_Trainee/QUICKSTART.th.md)**
  - **[🌧️ คู่มือการพัฒนาสำหรับ Rain (Junior Dev)](file:///e:/Trainee/Mango_VPN_Trainee/Rain/README.th.md)**
  - **[⚡ คู่มือการพัฒนาสำหรับ Sobree (Senior Dev)](file:///e:/Trainee/Mango_VPN_Trainee/Sobree/README.th.md)**

---

## 1. Team Monorepo Organization: `Rain` & `Sobree`

To ensure zero git conflicts and complete decoupling of responsibilities, the codebase is partitioned into two dedicated engineer directories:

```text
mango-vpn/
├── Rain/                          # 🌧️ [Junior Developer: Rain]
│   ├── portal/                    # React 19 + Vite + Tailwind CSS Web Portal UI
│   │   ├── src/App.tsx            # Dark UI, Status Pills, 2FA OTP, Green VPN CONNECT button
│   │   ├── package.json           # (@mango/portal)
│   │   └── Dockerfile
│   └── admin/                     # Admin CRUD Endpoints & Database Seed Script
│       ├── src/admin.service.ts   # Devices, Sessions, AuditLogs, AgentVersions logic
│       ├── src/admin.routes.ts    # Fastify route registrations
│       ├── src/seed.ts            # Database seed script (admin_user, staff_user, client_user)
│       └── package.json           # (@mango/rain-admin)
│
├── Sobree/                        # ⚡ [Senior Developer: Sobree]
│   ├── api/                       # Central Control Plane Management API
│   │   ├── prisma/schema.prisma   # 8-Table Zero-Trust Prisma Schema
│   │   ├── src/modules/auth/      # Step 1-4: Login, 6-digit OTP MFA, JWT
│   │   ├── src/modules/vpn/       # Step 5: IPAM (10.13.13.0/24), WireGuard negotiation
│   │   ├── src/server.ts          # Fastify entrypoint (mounts Rain's admin routes)
│   │   └── package.json           # (@mango/api)
│   ├── agent-windows/             # Go Windows Service (.exe, LocalSystem)
│   │   ├── main.go                # Curve25519 keygen, PNA CORS HTTP listener (127.0.0.1:47821)
│   │   └── go.mod
│   └── vpn-daemon/                # Go Linux WireGuard Gateway & nftables Daemon
│       ├── main.go                # Dynamic 'wg set' & role-based forward filter rules
│       └── go.mod
│
├── packages/
│   └── shared/                    # 🤝 [Shared Contracts & DTOs]
│       └── src/contracts.ts       # Shared TypeScript interfaces (Login, OTP, VPN, Agent)
│
├── scripts/
│   └── mock-agent.js              # 🧪 [Agent Simulator] 127.0.0.1:47821 loopback with PNA
├── docker-compose.yml             # Postgres 16, WireGuard Gateway (NET_ADMIN), API, Portal
├── package.json                   # Root monorepo workspace configuration
├── pnpm-workspace.yaml            # pnpm workspace definition
└── tsconfig.base.json             # Root TypeScript compiler options
```

---

## 2. Decoupled Team Responsibilities

| Responsibility | Rain (Junior) 🌧️ | Sobree (Senior) ⚡ |
| --- | --- | --- |
| **Workspace Folder** | `Rain/` | `Sobree/` |
| **Frontend UI** | `Rain/portal` (100% ownership) | Architectural review |
| **Admin CRUD** | `Rain/admin` (`/devices`, `/sessions`, `/audit-logs`, `/agent-versions`) | Route mounting in `server.ts` |
| **Database Seeding** | `Rain/admin/src/seed.ts` | Schema definition |
| **Backend Core** | Consumes auth & VPN APIs | `Sobree/api` (Prisma schema, Auth MFA, VPN IPAM) |
| **Windows Agent** | Uses `mock-agent.js` for UI testing | `Sobree/agent-windows` (Go Windows service) |
| **VPN Gateway** | N/A | `Sobree/vpn-daemon` (Linux `wg0` + `nftables`) |
| **Shared Contracts** | Consumes `@mango/shared` | Defines `@mango/shared` |

---

## 3. Workflow for Rain (Junior Developer)

Rain works entirely inside the `Rain/` directory without stepping on Sobree's code:

```powershell
# 1. Start the Local Windows Agent Simulator (in terminal 1)
npm run mock:agent

# 2. Start the Management API (in terminal 2)
npm run dev:api

# 3. Start the Portal UI (in terminal 3)
npm run dev:portal
```

- **Portal UI**: Open `http://localhost:3000`. Edit `Rain/portal/src/App.tsx`.
- **Admin CRUD**: Edit `Rain/admin/src/admin.service.ts` and `admin.routes.ts`.
- **Seed Database**: Run `npm run db:seed`.

---

## 4. Workflow for Sobree (Senior Developer)

Sobree works inside the `Sobree/` directory and shared contracts:

```powershell
# Run the database
docker compose up -d postgres

# Generate Prisma Client & Migrate
npm run db:generate
npm run db:migrate

# Start Backend API (Fastify)
npm run dev:api

# Test Windows Agent (Standalone Console Mode)
cd Sobree/agent-windows
go run main.go -debug

# Test Linux WireGuard Daemon
cd Sobree/vpn-daemon
go run main.go
```

---

## 5. Connection Workflow (5 Steps)

1. **Step 1 — Login:** User submits Username and Password on Portal (`POST /api/auth/login`).
2. **Step 2 — MFA Challenge:** Management API generates 6-digit OTP, masks phone number (`+1555****567`), returns `challengeId`.
3. **Step 3 — OTP Verification:** User enters the 6-digit verification code (`POST /api/auth/verify-otp`).
4. **Step 4 — Issue JWT:** Backend verifies OTP, generates signed `accessToken` (1 hour) and `refreshToken` (7 days).
5. **Step 5 — VPN Connect:**
   - Portal browser checks `GET http://127.0.0.1:47821/health` (verified via Chromium Private Network Access).
   - User clicks **VPN CONNECT**.
   - Portal issues `POST http://127.0.0.1:47821/connect` with `accessToken`.
   - Local Windows Agent generates local Curve25519 keypair, calls Backend `POST /api/vpn/connect`.
   - Backend allocates IP from `10.13.13.0/24`, registers peer (`wg set`), configures `nftables` forwarding rules, returns tunnel parameters.
   - Local Agent activates WireGuard interface.
   - Portal UI updates state to **Connected** and displays the dynamically assigned IP.

---

## 6. Monorepo Scripts Reference

| Command | Action |
| --- | --- |
| `npm run dev:portal` | Starts Rain's React + Vite frontend on `http://localhost:3000` |
| `npm run dev:api` | Starts Sobree's Fastify API on `http://localhost:4000` (auto-mounts Rain's admin routes) |
| `npm run mock:agent` | Runs the zero-dependency Windows Agent loopback simulator (`http://127.0.0.1:47821`) |
| `npm run db:generate` | Generates `@prisma/client` from `Sobree/api/prisma/schema.prisma` |
| `npm run db:seed` | Runs Rain's database seed script (`Rain/admin/src/seed.ts`) |
| `npm run build` | Builds all packages across workspaces (`@mango/shared`, `@mango/rain-admin`, `@mango/api`, `@mango/portal`) |
| `npm run docker:up` | Starts Docker Compose stack (`postgres`, `vpn-gateway`, `api`, `portal`) |
