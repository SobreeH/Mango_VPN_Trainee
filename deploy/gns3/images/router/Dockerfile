FROM alpine:3.20

RUN apk add --no-cache iproute2 nftables iptables tcpdump curl bash jq
COPY deploy/gns3/images/router/entrypoint.sh /usr/local/bin/router-entrypoint.sh
COPY deploy/gns3/setup-wan-router.sh /usr/local/bin/setup-wan-router.sh
COPY deploy/gns3/setup-private-router.sh /usr/local/bin/setup-private-router.sh
RUN chmod +x /usr/local/bin/router-entrypoint.sh /usr/local/bin/setup-wan-router.sh /usr/local/bin/setup-private-router.sh

ENTRYPOINT ["/usr/local/bin/router-entrypoint.sh"]
