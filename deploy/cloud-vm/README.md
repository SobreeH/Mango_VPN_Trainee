# Cloud VM deployment

This profile runs the MANGO VPN control plane, WireGuard gateway, portal,
PostgreSQL, and Caddy on one Linux VM. Only WireGuard UDP and Caddy HTTP(S)
are published to the VM host; PostgreSQL, the API, and the daemon API remain
on the private Docker network.

## Quick launch

From the repository root:

```sh
cp deploy/cloud-vm/.env.cloud.example .env.cloud
# Fill all required values in .env.cloud. Generate secrets and WireGuard keys
# with the commands documented in .env.example.
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml \
  --env-file .env.cloud up -d --build
```

Set `MANGO_DOMAIN` to an EC2 public-IP hostname such as
`198-51-100-24.sslip.io` or to a DNS name. Set `WG_SERVER_ENDPOINT` to the
same public address with `:51820`. For the same-origin Caddy layout,
`CORS_ORIGIN` and `VITE_API_URL` should both be `https://<MANGO_DOMAIN>`.
Allow TCP 80/443 and UDP 51820 in the VM's security group/firewall.

## Optional private targets

The target overlay adds the three test target containers without the local
test harness or a public harness port:

```sh
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml \
  -f deploy/cloud-vm/docker-compose.cloud-targets.yml \
  --env-file .env.cloud up -d --build
```

The overlay routes `10.99.0.0/24`, `10.20.0.0/16`, and `10.30.0.0/24`
through the gateway's private target network.

## Seed and inspect

The API image runs Prisma migrations during startup and includes the compiled
seeders (`Rain/admin/dist/seed.js` and `Rain/admin/dist/seed-test-targets.js`),
so you can seed directly inside the `api` container without exposing PostgreSQL
port `5432`:

```sh
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml \
  --env-file .env.cloud exec \
  -e SEED_ADMIN_USERNAME=admin \
  -e SEED_ADMIN_PASSWORD='<Choose-12+-Char-Password>' \
  api node Rain/admin/dist/seed.js
```

```sh
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml \
  --env-file .env.cloud ps
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml \
  --env-file .env.cloud logs -f api vpn-gateway caddy
```

## Teardown

Stop and remove containers while retaining database data:

```sh
docker compose -f deploy/cloud-vm/docker-compose.cloud.yml \
  --env-file .env.cloud down
```

Add `-f deploy/cloud-vm/docker-compose.cloud-targets.yml` when the overlay is
active. Do not add `-v` unless the PostgreSQL data volume should be destroyed.
