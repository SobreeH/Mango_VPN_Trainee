# MANGO VPN

> A centralized, web-managed WireGuard remote access prototype developed by two undergraduate engineering trainees as a Cooperative Education (Co-op) capstone project.

MANGO VPN is a proof-of-concept remote access system designed to eliminate manual VPN configuration for corporate end-users. By integrating a centralized web portal, a RESTful management API, and a custom background Windows Agent service, the system automates secure WireGuard tunnel provisioning and policy enforcement through standard web authentication.

---

## Architecture Overview

```text
+-------------------------------------------------------------+
|                      MANGO VPN Portal                       |
|               (Web Dashboard / Authentication)              |
+------------------------------+------------------------------+
                               |
                        HTTPS / REST API
                               |
+------------------------------v------------------------------+
|                     VPN Management API                      |
|       (Session / Device / WireGuard Config / Policy Engine) |
+--------------+-------------------------------+--------------+
               |                               |
        Local IPC / API                 WireGuard Peer Config
               |                               |
+--------------v---------------+ +-------------v--------------+
|      Client Endpoint         | |         VPN Server         |
|  - Windows Service Agent     | |   - WireGuard Gateway      |
|  - WireGuard Client Engine   | |                            |
+--------------+---------------+ +-------------+--------------+
               |                               |
               +======= Encrypted Tunnel ======+
                               |
               +---------------v---------------+
               |        Private Network        |
               | (Internal Apps, DBs, Servers) |
               +-------------------------------+

```

### Components

* **MANGO VPN Portal:** Web-based frontend handling user sign-in, real-time agent/connection status telemetry, and account management.
* **VPN Management API:** Central control plane responsible for credential validation, session state management, role-based access control (RBAC), and WireGuard peer configuration generation.
* **Client Agent (Windows Service):** Lightweight background service installed on the client machine that listens for authorized instructions from the backend and manages the local WireGuard tunnel interface.
* **VPN Server (WireGuard):** Linux-based WireGuard gateway terminating client tunnels and routing traffic to protected subnets.
* **Target Private Network:** Internal network assets (databases, intranet services, internal APIs) accessible exclusively through the VPN tunnel.

---

## Connection Workflow

```text
[User] -> (Portal Sign-in) -> [Management API] -> (Authorize)
                                      |
[WireGuard Server] <--- (Assign IP) --+--> (Signal) -> [Windows Agent]
        ^                                                    |
        +================ (Establish Tunnel) ================+

```

1. **Initial Setup:** The client installs the background Windows Service Agent.
2. **Access Portal:** The user navigates to the MANGO VPN Web Portal in a browser.
3. **Authentication:** The user inputs their corporate credentials and initiates the connection.
4. **Validation:** The Management API verifies credentials, device registration, and active network access policies.
5. **Instruction Dispatch:** Upon successful authorization, the backend signals the local Windows Agent.
6. **Tunnel Initialization:** The Agent configures the local WireGuard adapter with assigned peer parameters and establishes the encrypted tunnel.
7. **Status Update:** The Portal updates the connection indicator to **Connected** and displays the dynamically assigned VPN IP address.

---

## Portal Interface Specification

```text
+-------------------------------------------------------+
|  MANGO VPN  |  Portal Online                          |
+-------------------------------------------------------+
|                                                       |
|  Sign in to VPN                                       |
|  Enter credentials to access VPN                      |
|                                                       |
|  Username: [ your.username                          ] |
|  Password: [ ••••••••••••                           ] |
|                                                       |
|  [           VPN CONNECT           ]                  |
|                                                       |
|  ---------------------------------------------------  |
|  Status Indicators:                                   |
|    Agent Status: [ Installed    ]                     |
|    Connection:   [ Disconnected ]                     |
|                                                       |
+-------------------------------------------------------+

```

---

## Database Schema

The relational backend schema enforces security policies, dynamic address allocation, and session tracking:

| Table | Description & Responsibilities |
| --- | --- |
| `users` | User profile data, hashed credentials, account status, and metadata. |
| `roles` | Role-based authorization tiers (`Admin`, `User`, `Restricted`). |
| `devices` | Registered client hardware identifiers, device trust levels, and OS metadata. |
| `vpn_peers` | WireGuard public keys, preshared keys, and assigned static/dynamic IP addresses. |
| `vpn_sessions` | Active connection state, session start/end timestamps, and data transfer metrics. |
| `vpn_policies` | Network Access Control (NAC) lists, route definitions, and subnet restrictions. |
| `audit_logs` | Immutable audit trail for authentication attempts, connection events, and policy edits. |
| `agent_versions` | Version control manifest and update tracking for the Windows Client Agent. |

---

## Security Model

* **Decoupled Architecture:** Users never directly handle WireGuard private keys or configuration files; configurations are generated dynamically and applied programmatically via the local service agent.
* **Zero Direct Peer Exposure:** The portal operates purely as an authentication and signaling plane; all data routing occurs over the encrypted UDP WireGuard tunnel.
* **Auditability:** Every authentication attempt, connection state transition, and configuration change is logged to `audit_logs` for compliance verification.

---

## Project Context

* **Project Type:** Undergraduate Cooperative Education (Co-op) Capstone Project
* **Team Size:** 2 Trainee Engineers
* **Deliverable:** Working proof-of-concept (PoC) demonstrating software-defined remote access orchestration, systems programming, and secure network infrastructure design.
