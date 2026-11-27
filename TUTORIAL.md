> 🌐 **Language / ภาษา**: **English (`TUTORIAL.md`)** | [🇹🇭 ภาษาไทย (`TUTORIAL.th.md`)](TUTORIAL.th.md)

# MANGO VPN v2: First-Time Tutorial (Index)

Welcome! This handbook takes you from a fresh clone to a working MANGO VPN v2 setup on **Windows (PowerShell)** or **Linux (Bash)**. It is split into short chapters so you can read only the part you need. Start with chapter 00, then follow the track you chose.

> **Safety note:** This is a local development and demo setup, not a production deployment. Keep your `.env` file private, and do not reuse its generated secrets anywhere else.

## Which Track Should I Choose?

| Track | Choose this if… | What it proves | What you need |
|---|---|---|---|
| **Track A: Docker-free local dev** ([chapter 01](docs/tutorial/01-track-a-local-dev.md)) | You are learning the portal and Admin CRUD, or do not want to configure a real tunnel yet. | Sign-in with TOTP, the API, Admin CRUD, gateway peer and policy requests, and the simulated agent UI. The mock daemon and mock agent do **not** activate a real WireGuard tunnel or `nftables` enforcement. | Node.js, Git, and an authenticator app. **No Docker required.** Works on Windows and Linux. |
| **Track B: GNS3 mock cloud lab** ([chapter 02](docs/tutorial/02-track-b-gns3-mock-cloud.md)) | You want the real Go agent, a real gateway, and a real WireGuard tunnel inside a simulated cloud network. | Real ticket flow, agent key generation, real tunnel activation, and gateway peer and policy programming inside a mock cloud topology. | GNS3 with the staged assets in `deploy/gns3/`, plus Docker, Go 1.26+, and the WireGuard tools for your OS. |
| **Track C1: Single cloud VM** ([chapter 03](docs/tutorial/03-track-c-cloud-deployment.md)) | You want the whole Docker stack running on one Linux server you control. | The API, portal, PostgreSQL, and gateway containers on a cloud VM, using the staged `deploy/cloud-vm/` files. | A Linux cloud VM, Docker with Compose v2, and a domain name or `<IP>.sslip.io` for HTTPS (plus SSH port-forward fallback). |
| **Track C2: Managed AWS stack** ([chapter 03](docs/tutorial/03-track-c-cloud-deployment.md)) | You want a managed AWS deployment built from CloudFormation. | The managed stack from `deploy/aws-managed/template.yaml`: ECS services, RDS PostgreSQL, a gateway EC2 instance, and secrets in Secrets Manager. | An AWS account with permission to create the stack, AWS CLI v2, and an ACM certificate with a custom domain for HTTPS (or CloudFront/SSM fallback). |

Track A is the right first step for nearly everyone. Tracks B and C need more setup and cost more to run.

## Chapter Directory

| # | Chapter | Contents |
|---|---|---|
| 00 | [Overview & Setup](docs/tutorial/00-overview-and-setup.md) | The big picture, the v2 connection lifecycle, readiness checks, and `.env` setup. |
| 01 | [Track A: Local Dev (Docker-free)](docs/tutorial/01-track-a-local-dev.md) | Embedded PostgreSQL, the admin seed, and the five-terminal startup. |
| 02 | [Track B: GNS3 Mock Cloud](docs/tutorial/02-track-b-gns3-mock-cloud.md) | The GNS3 lab, the real Go agent, and the WireGuard tunnel. |
| 03 | [Track C: Cloud Deployment](docs/tutorial/03-track-c-cloud-deployment.md) | Single cloud VM (C1) and the managed AWS stack (C2). |
| 04 | [Testing Playbook](docs/tutorial/04-testing-playbook.md) | Missions 1 to 4 in the portal, gateway inspection, and the automated suite. |
| 05 | [Troubleshooting & Reference](docs/tutorial/05-troubleshooting-and-reference.md) | Symptom tables, the environment variable reference, and clean shutdown for every track. |
| 06 | [Appendix: Local Docker Smoke Test](docs/tutorial/06-appendix-local-docker-smoke-test.md) | The Docker stack, optional test targets, and the localhost role harness. |

If you are new, read in this order: **00, then 01, then 04**. Use **05** whenever something does not match the expected result.
