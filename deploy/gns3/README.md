# Track B: GNS3 mock cloud

This lab models a client LAN, a public WAN, an Ubuntu control-plane VM, and a
private router with three segmented target zones. It is intended for the
tutorial in [`docs/tutorial/02-track-b-gns3-mock-cloud.md`](../../docs/tutorial/02-track-b-gns3-mock-cloud.md).

## Topology and address plan

| Segment | Device/interface | Address |
| --- | --- | --- |
| Client LAN `192.168.50.0/24` | Client VM / WAN router `eth0` | `192.168.50.10` / `192.168.50.1` |
| Public WAN `203.0.113.0/24` | WAN router `eth1` / control VM `eth0` | `203.0.113.1` / `203.0.113.10` |
| Private transit `172.28.0.0/24` | control VM `eth1` / private router `eth0` | `172.28.0.2` / `172.28.0.1` |
| Admin `10.99.0.0/24` | private router `eth1` / target | `10.99.0.1` / `10.99.0.10` |
| Staff `10.20.0.0/16` | private router `eth2` / target | `10.20.0.1` / `10.20.0.10` |
| Client zone `10.30.0.0/24` | private router `eth3` / target | `10.30.0.1` / `10.30.0.10` |
| WireGuard `10.13.13.0/24` | gateway `wg0` | `10.13.13.1` |

The Compose bridge `mango-gns3-net` is `172.29.0.0/24`; the gateway is fixed
at `172.29.0.10`. This keeps the Docker namespace separate from the GNS3
transit network. Docker bridge masquerading gives the default reliable return
path through the Ubuntu VM's `172.28.0.2` address. For no-NAT source-IP
inspection, add this route on the Ubuntu control-plane VM after confirming the
Docker bridge exists:

```sh
ip route replace 10.13.13.0/24 via 172.29.0.10
```

## Bring up the lab

1. Attach the GNS3 interfaces in the order shown above and boot the WAN and
   private router nodes.
2. On the WAN router, run `setup-wan-router.sh`. Set `ENABLE_NAT=true` only
   when the lab needs masquerading; the WAN router deliberately omits routes to
   `10.13.13.0/24` and `10.99/10.20/10.30` so private subnets are only
   reachable inside WireGuard.
3. On the private router, run `setup-private-router.sh`. It deliberately does
   not add a route to `192.168.50.0/24`, preserving client-LAN isolation.
4. On each target VM run `setup-target-node.sh` with `ZONE=admin`, `ZONE=staff`,
   or `ZONE=client` (the script accepts the zone as its first argument too).
5. On the Ubuntu control-plane VM, copy the repository and create an env file
   with all required secrets, then start the stack:

```sh
docker compose -f deploy/gns3/docker-compose.gns3.yml --env-file .env up -d --build
```

The Compose file binds PostgreSQL only to `127.0.0.1:15432`, allowing host-side
Prisma seed commands without exposing the database on the mock public WAN.
Use `https://vpn.mango.lab` and trust Caddy's locally generated internal CA in
the lab client. The API and portal are reachable through Caddy; daemon API
port 50051 is internal to the Compose network.

## Useful checks

```sh
docker compose -f deploy/gns3/docker-compose.gns3.yml ps
docker compose -f deploy/gns3/docker-compose.gns3.yml logs -f vpn-gateway api caddy
curl -k https://vpn.mango.lab/health
curl -k https://10.99.0.10/health.json
```

The gateway's nftables policy is created inside its own container network
namespace. It therefore cannot install a host-wide forward policy that would
break Docker bridges.
