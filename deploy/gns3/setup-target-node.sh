#!/bin/sh
set -eu

ZONE=${ZONE:-${1:-}}
IFACE=${IFACE:-eth0}
case "$ZONE" in
  admin) TARGET_IP=10.99.0.10; PREFIX=24; GATEWAY=10.99.0.1; TITLE="Admin Restricted Console" ;;
  staff) TARGET_IP=10.20.0.10; PREFIX=16; GATEWAY=10.20.0.1; TITLE="Staff Internal Web" ;;
  client) TARGET_IP=10.30.0.10; PREFIX=24; GATEWAY=10.30.0.1; TITLE="Client Shared Portal" ;;
  *) echo "usage: ZONE=admin|staff|client $0" >&2; exit 2 ;;
esac

if command -v apk >/dev/null 2>&1; then
  command -v nginx >/dev/null 2>&1 || apk add --no-cache nginx
  command -v openssl >/dev/null 2>&1 || apk add --no-cache openssl
elif command -v apt-get >/dev/null 2>&1; then
  command -v nginx >/dev/null 2>&1 || { apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y nginx; }
  command -v openssl >/dev/null 2>&1 || { apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y openssl; }
else
  command -v nginx >/dev/null 2>&1 || { echo "nginx is required" >&2; exit 1; }
  command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }
fi

ip link set up dev "$IFACE"
ip addr replace "$TARGET_IP/$PREFIX" dev "$IFACE"
ip route replace default via "$GATEWAY" dev "$IFACE"
ip route replace 10.13.13.0/24 via "$GATEWAY" dev "$IFACE"
mkdir -p /etc/nginx/certs /usr/share/nginx/html /run/nginx
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout /etc/nginx/certs/server.key -out /etc/nginx/certs/server.crt \
  -subj "/CN=$TARGET_IP" -addext "subjectAltName=IP:$TARGET_IP"

cat > /usr/share/nginx/html/index.html <<EOF
<!doctype html><html><head><meta charset="utf-8"><title>$TITLE</title></head>
<body><h1>$TITLE</h1><p>GNS3 target node: $TARGET_IP</p><p>VPN access is policy controlled.</p></body></html>
EOF

NGINX_CONF_PATH=/etc/nginx/conf.d/default.conf
if [ -d /etc/nginx/http.d ]; then
  NGINX_CONF_PATH=/etc/nginx/http.d/default.conf
fi
rm -f /etc/nginx/sites-enabled/default

cat > "$NGINX_CONF_PATH" <<EOF
server {
  listen $TARGET_IP:80;
  listen $TARGET_IP:443 ssl;
  server_name _;
  ssl_certificate /etc/nginx/certs/server.crt;
  ssl_certificate_key /etc/nginx/certs/server.key;
  location = /health.json {
    if (\$request_method = OPTIONS) {
      add_header Access-Control-Allow-Origin "*" always;
      add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
      add_header Access-Control-Allow-Headers "Content-Type, Access-Control-Request-Private-Network" always;
      add_header Access-Control-Allow-Private-Network "true" always;
      return 204;
    }
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, Access-Control-Request-Private-Network" always;
    add_header Access-Control-Allow-Private-Network "true" always;
    add_header Cache-Control "no-store" always;
    default_type application/json;
    return 200 '{"ok":true,"zone":"$ZONE","targetIp":"$TARGET_IP","clientVpnIp":"\$remote_addr"}';
  }
  location / { root /usr/share/nginx/html; index index.html; try_files \$uri \$uri/ /index.html; }
}
EOF

nginx -t
nginx -s stop 2>/dev/null || true
exec nginx -g 'daemon off;'
