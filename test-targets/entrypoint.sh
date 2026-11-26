#!/bin/sh
set -eu
ip addr replace "${TARGET_IP}/32" dev lo
ip route replace "${VPN_SUBNET}" via "${GATEWAY_TRANSIT_IP}"
mkdir -p /etc/nginx/certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt \
  -subj "/CN=${TARGET_IP}" -addext "subjectAltName=IP:${TARGET_IP}"
envsubst '${TARGET_IP} ${ZONE_ID} ${ZONE_TITLE}' < /etc/nginx/templates/target.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
