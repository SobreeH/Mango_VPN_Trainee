# 🚀 MANGO VPN - Quick Start & Tool Readiness Guide

[English](QUICKSTART.md) | [ภาษาไทย](QUICKSTART.th.md)

This guide details all **software tools, programs, runtimes, and dependencies** required to develop, run, and test MANGO VPN, along with step-by-step instructions on **how to check if your machine is ready**.

---

## 1. Tool Matrix & Role Requirements

| Tool / Program | Required For | Min Version | Recommended | Purpose in MANGO VPN | Official Download |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Node.js** | **Both** (Rain & Sobree) | `18.0.0` | `20 LTS` or `22 LTS` | Management API, Web Portal, Shared contracts, TypeScript compiler | [nodejs.org](https://nodejs.org/) |
| **npm** | **Both** (Rain & Sobree) | `9.0.0` | `10.x` | Monorepo workspaces (`Rain/*`, `Sobree/*`, `packages/*`) | Bundled with Node |
| **Git** | **Both** (Rain & Sobree) | `2.30.0` | Latest | Version control and monorepo branching | [git-scm.com](https://git-scm.com/) |
| **Docker Desktop** | **Sobree** (Senior Dev) | `24.0.0` | Latest | PostgreSQL 16 DB container & Linux WireGuard gateway (`NET_ADMIN`) | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Go Toolchain** | **Sobree** (Senior Dev) | `1.22.0` | `1.22+` | Windows Service agent (`apps/agent-windows`) & Linux VPN daemon (`services/vpn-daemon`) | [go.dev](https://go.dev/dl/) |
| **WireGuard** | **Sobree** (Senior Dev) | `0.5.3` | Latest | Client tunnel interface testing on Windows | [wireguard.com](https://www.wireguard.com/install/) |
| **VS Code** *(Optional)* | **Both** | Latest | Latest | Code editing with syntax highlighting & auto-complete | [code.visualstudio.com](https://code.visualstudio.com/) |

> [!NOTE]
> **Junior Developer (Rain) Notice**: If you are working on the Web Portal UI (`Rain/portal`) or Admin CRUD (`Rain/admin`), you **only need Node.js and Git**! You can test the entire application using the included Node.js mock agent simulator (`scripts/mock-agent.js`) without installing Go, Docker, or WireGuard.

---

## 2. Automated Readiness Verification Script

We provide a built-in automated PowerShell script that inspects your system and outputs a readiness summary:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-environment.ps1
```

You can also run it via npm:
```powershell
npm run check:env
```

### Expected Output Example:
```text
============================================================
   MANGO VPN - Development Environment Readiness Check      
============================================================

Tool            Status  RequiredFor             Requirement          DetectedVersion
----            ------  -----------             -----------          ---------------
Node.js         READY   Both (Rain & Sobree)    >= 18.0.0 (LTS 20+)  v20.12.1
npm             READY   Both (Rain & Sobree)    >= 9.0.0             10.5.0
Git             READY   Both (Rain & Sobree)    >= 2.30.0            git version 2.44.0
Docker CLI      READY   Sobree (Senior Dev)     >= 24.0.0            Docker version 25.0.3
Docker Compose  READY   Sobree (Senior Dev)     >= v2.20.0           Docker Compose version v2.24.6
Go Toolchain    READY   Sobree (Senior Dev)     >= 1.22.0            go version go1.22.1 windows/amd64

Role Readiness Summary:
  [READY] Rain (Junior Dev): All required tools are INSTALLED!
  [READY] Sobree (Senior Dev): All systems tools are INSTALLED!
============================================================
```

---

## 3. Manual CLI Check Commands

If you prefer to check tools individually in PowerShell or Command Prompt:

### 1. Check Node.js and npm
```powershell
node -v
npm -v
```
- **Expected**: `v18.x.x`, `v20.x.x`, or `v22.x.x` (e.g. `v20.12.1`)
- **If missing**: Download and install the **LTS** version from [nodejs.org](https://nodejs.org/). Make sure to check the box **"Add to PATH"**.

### 2. Check Git
```powershell
git --version
```
- **Expected**: `git version 2.x.x`
- **If missing**: Install from [git-scm.com](https://git-scm.com/).

### 3. Check Docker and Docker Compose (Sobree)
```powershell
docker -v
docker compose version
```
- **Expected**: `Docker version 24+` and `Docker Compose version v2.+`
- **Check Daemon Status**:
  ```powershell
  docker info
  ```
  If it displays `error during connect: ... open //./pipe/dockerDesktopLinuxEngine`, simply launch the **Docker Desktop** application from your Windows Start menu and wait until the whale icon says "Engine running".

### 4. Check Go Toolchain (Sobree)
```powershell
go version
```
- **Expected**: `go version go1.22.x windows/amd64`
- **If missing**: Download the Windows `.msi` installer from [go.dev/dl](https://go.dev/dl/).

---

## 4. Port Allocation Map

Ensure the following default local ports are not occupied by other software on your machine:

| Port | Protocol | Component | Used By |
| :--- | :--- | :--- | :--- |
| **3000** | TCP (HTTP) | MANGO Web Portal (Vite Dev Server) | Rain |
| **4000** | TCP (HTTP) | VPN Management API (Fastify Control Plane) | Sobree |
| **5432** | TCP (PostgreSQL) | PostgreSQL 16 Database Container | Docker / Sobree |
| **47821** | TCP (HTTP / PNA) | Windows Client Agent (Loopback Listener) | Mock Agent / Go Service |
| **51820** | UDP (WireGuard) | WireGuard Gateway Tunnel Endpoint | Linux Server / Gateway Container |
| **50051** | TCP (IPC fallback)| VPN Policy Daemon Socket / RPC | Sobree |

To check if a specific port is in use on Windows:
```powershell
# Example: check if port 4000 is open
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue
```

---

## 5. Recommended VS Code Extensions

For the best developer experience, we recommend installing these VS Code extensions:

1. **Prisma** (`Prisma.prisma`): Syntax highlighting and schema auto-completion for `Sobree/api/prisma/schema.prisma`.
2. **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`): Class name auto-completion for `Rain/portal`.
3. **Go** (`golang.Go`): Rich language support, debugging, and code navigation for Go in `Sobree/`.
4. **ESLint** (`dbaeumer.vscode-eslint`): Static code quality checks for TypeScript.
5. **GitLens** (`eamodio.gitlens`): Commit tracking and conflict visualizer.

---

## 6. First-Time Setup Instructions

Once your tools are verified:

### Step 1: Install Monorepo Dependencies
From the repository root:
```powershell
npm install
```

### Step 2: Build All Shared Contracts & Packages
```powershell
npm run build
```

### Step 3: Choose Your Workflow
- **Rain (Junior Dev)**: Open [`Rain/README.md`](file:///e:/Trainee/Mango_VPN_Trainee/Rain/README.md) and run:
  ```powershell
  npm run mock:agent   # Terminal 1
  npm run dev:api      # Terminal 2
  npm run dev:portal   # Terminal 3
  ```
- **Sobree (Senior Dev)**: Open [`Sobree/README.md`](file:///e:/Trainee/Mango_VPN_Trainee/Sobree/README.md) and run:
  ```powershell
  docker compose up -d postgres
  npm run db:generate
  npm run dev:api
  ```

