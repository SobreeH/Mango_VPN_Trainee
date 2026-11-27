#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
docker build -t mango-gns3-router:local -f deploy/gns3/images/router/Dockerfile .
docker build -t mango-gns3-target:local -f deploy/gns3/images/target/Dockerfile .
docker build -t mango-gns3-harness:local -f deploy/gns3/images/harness/Dockerfile .
docker build -t mango-gns3-coredns:local -f deploy/gns3/images/coredns/Dockerfile .
docker build -t mango-gns3-probe:local -f deploy/gns3/images/probe/Dockerfile .
docker build -t mango-gns3-appliance-sim:local -f deploy/gns3/images/appliance-sim/Dockerfile .
docker build -t mango-gns3-alb-caddy:local -f deploy/gns3/images/alb-caddy/Dockerfile .
docker build -t mango-gns3-openbao:local -f deploy/gns3/images/openbao/Dockerfile deploy/gns3/images/openbao
docker build -t mango-gns3-prometheus:local -f deploy/gns3/images/prometheus/Dockerfile deploy/gns3/images/prometheus
docker build -t mango-gns3-loki:local -f deploy/gns3/images/loki/Dockerfile deploy/gns3/images/loki
docker build -t mango-gns3-grafana:local -f deploy/gns3/images/grafana/Dockerfile deploy/gns3/images/grafana
docker build -t mango-gns3-rustfs:local -f deploy/gns3/images/rustfs/Dockerfile deploy/gns3/images/rustfs
docker build -t mango-gns3-gateway:local -f Sobree/vpn-daemon/Dockerfile .
docker build -t mango-gns3-api:local -f Sobree/api/Dockerfile .
docker build -t mango-gns3-ecs-api:local -f deploy/gns3/images/ecs-api/Dockerfile .
docker build --build-arg VITE_API_URL=https://vpn.mango.lab --build-arg VITE_AGENT_URL=http://127.0.0.1:47821 -t mango-gns3-portal:local -f Rain/portal/Dockerfile .
