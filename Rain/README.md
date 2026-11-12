# 🌧️ Rain's Development Guide

[English](README.md) | [ภาษาไทย](README.th.md)

Welcome, **Rain**! This guide is your single source of truth for developing, running, and testing your components in MANGO VPN without blockers or merge conflicts.

---

## 1. Your Scope & Ownership

You own **100% of the user experience and administrative CRUD interfaces**:

1. **`Rain/portal/`**: The modern Dark-mode Web Portal (React 19 + Vite + Tailwind CSS + Lucide Icons).
2. **`Rain/admin/`**: The Admin CRUD module (`@mango/rain-admin`) and the database seeding script (`src/seed.ts`).
3. **Mock Agent Testing**: Using `scripts/mock-agent.js` so you never have to compile Go code or run kernel WireGuard to develop frontend features.

> [!NOTE]
> **No Git Conflicts**: All your code lives inside `Rain/`. You never need to edit files in `Sobree/`. When you update your admin routes or seed scripts, Sobree's API automatically picks them up via workspace imports!

---

## 2. Prerequisites for Rain

You **only need Node.js** to do your entire job! You do **not** need Go, Docker, or Linux kernel capabilities.

- **Node.js**: >= 18.0.0 (Node 20+ LTS recommended)
- **npm**: >= 9.0.0 (bundled with Node)

Verify your environment in terminal:
```powershell
node -v
npm -v
```

---

## 3. Daily Development Routine (3 Terminals)

Open three terminal windows in the root of `Mango_VPN_Trainee`:

### Terminal 1: Run the Mock Windows Agent
```powershell
npm run mock:agent
```
- **Address**: `http://127.0.0.1:47821`
- **Purpose**: Simulates the Windows Agent service. It has **Private Network Access (PNA)** enabled so your browser can communicate directly with loopback without CORS errors.

---

### Terminal 2: Run the Management API Backend
```powershell
npm run dev:api
```
- **Address**: `http://localhost:4000`
- **Purpose**: Starts Sobree's Fastify API, which automatically mounts your `Rain/admin` CRUD routes!
- **Watch the logs**: When you test login, the 6-digit OTP will print here!

---

### Terminal 3: Run Your Web Portal UI
```powershell
npm run dev:portal
```
- **Address**: `http://localhost:3000`
- **Purpose**: Starts the Vite dev server with Hot Module Replacement (HMR).

---

## 4. How the Portal UI Works (`Rain/portal`)

The entrypoint is [`Rain/portal/src/App.tsx`](file:///e:/Trainee/Mango_VPN_Trainee/Rain/portal/src/App.tsx).

### A. Status Indicator Pills
At the top right of the dashboard:
1. **Portal Online**: Automatically checks `GET http://localhost:4000/health`. Turns green if API is up.
2. **Agent Status**: Polls `GET http://127.0.0.1:47821/health` every 3 seconds.
   - Shows **Installed (1.0.0-mock)** when `npm run mock:agent` is running.
   - Shows **Not Detected** if the agent simulator is stopped.
3. **Connection**: Shows `Disconnected`, `Connecting` (amber pulse), or `Connected` (green).

### B. The 5-Step Connection Flow
1. **Sign In**: User inputs username and password.
   - Pre-seeded accounts:
     - Admin: `admin_user` / `MangoVPN2026!`
     - Staff: `staff_user` / `MangoVPN2026!`
     - Client: `client_user` / `MangoVPN2026!`
2. **MFA Challenge**: Portal calls `POST /api/auth/login`. Server returns a `challengeId` and masked phone number (e.g. `+1555****567`).
3. **Verify OTP**: Modal displays. User inputs the 6-digit code (check Terminal 2 console for the code). Calls `POST /api/auth/verify-otp`.
4. **Issue JWT**: Server issues `accessToken`.
5. **VPN Connect**: User clicks the big green **VPN CONNECT** button:
   - Portal calls `POST http://127.0.0.1:47821/connect` with `accessToken`.
   - Mock agent establishes the tunnel and returns an assigned IP (e.g. `10.13.13.45/32`).
   - UI updates to **Connected**, displaying live RX/TX bandwidth metrics and a **DISCONNECT VPN** button.

---

## 5. Developing Admin CRUD (`Rain/admin`)

Your admin code is in [`Rain/admin/src/`](file:///e:/Trainee/Mango_VPN_Trainee/Rain/admin/src/):

| File | Purpose |
| --- | --- |
| `admin.service.ts` | Database queries via Prisma for devices, sessions, audit-logs, and agent versions |
| `admin.controller.ts` | Request validation and HTTP response formatting |
| `admin.routes.ts` | Fastify endpoint mappings (`/api/devices`, `/api/sessions`, etc.) |
| `seed.ts` | Database seeding script creating test users, roles, and default policies |

### Available Endpoints You Own:
- `GET /api/devices`: List registered client machines.
- `GET /api/sessions`: List connection history and duration.
- `GET /api/audit-logs`: Security activity audit logs (Admin only).
- `GET /api/agent-versions`: Latest Windows Agent installer version.

### Running Database Seeding:
When the PostgreSQL database is running, re-populate mock data with:
```powershell
npm run db:seed
```

---

## 6. Building & Typechecking Your Code

Before submitting a pull request or handing off to Sobree, verify your code compiles with zero errors:

```powershell
# Typecheck your admin module
npm --workspace=@mango/rain-admin run build

# Typecheck and build your portal frontend
npm --workspace=@mango/portal run build

# Or build the entire monorepo
npm run build
```

---

## 7. Troubleshooting & FAQs

### Q: Why does the portal say "Agent: Not Detected"?
> **Fix**: You haven't started the agent simulator. Run `npm run mock:agent` in a separate terminal.

### Q: Why does the browser block requests to `127.0.0.1:47821`?
> **Fix**: Chromium browsers enforce **Private Network Access (PNA)**. Our `mock-agent.js` automatically returns the required `Access-Control-Allow-Private-Network: true` header. Make sure you are using `npm run mock:agent` and accessing the portal at `http://localhost:3000`.

### Q: Where do I find the 6-digit OTP code?
> **Fix**: Look at Terminal 2 where `npm run dev:api` is running. In dev mode, the backend prints:
> ```text
> ==================================================
> [AUTH MFA] 6-Digit OTP:  >>>>> 482910 <<<<<
> ==================================================
> ```

---

Good luck, Rain! If you need help with API contracts or database schema changes, check [`packages/shared/src/contracts.ts`](file:///e:/Trainee/Mango_VPN_Trainee/packages/shared/src/contracts.ts) or ask Sobree.

