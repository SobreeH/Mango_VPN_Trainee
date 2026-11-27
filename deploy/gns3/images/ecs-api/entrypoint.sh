#!/bin/sh
set -eu

db_host=${DB_HOST:-10.50.10.20}
db_port=${DB_PORT:-5432}
if [ -n "${DATABASE_URL:-}" ]; then
  db_target=$(node -e 'const u = new URL(process.argv[1]); process.stdout.write(`${u.hostname}:${u.port || "5432"}`)' "$DATABASE_URL")
  db_host=${db_target%:*}
  db_port=${db_target##*:}
fi

echo "Waiting for PostgreSQL at ${db_host}:${db_port}"
ready=false
for _ in $(seq 1 90); do
  if node -e 'const net=require("net"); const s=net.createConnection({host:process.argv[1],port:Number(process.argv[2])}); s.setTimeout(800); s.on("connect",()=>{s.end();process.exit(0)}); s.on("error",()=>process.exit(1)); s.on("timeout",()=>{s.destroy();process.exit(1)})' "$db_host" "$db_port"; then
    ready=true
    break
  fi
  sleep 1
done
[ "$ready" = true ] || { echo "PostgreSQL did not become ready" >&2; exit 1; }

attempt=1
while :; do
  if npx prisma migrate deploy --schema=Sobree/api/prisma/schema.prisma; then
    break
  fi
  [ "$attempt" -lt 5 ] || { echo "Prisma migrations failed" >&2; exit 1; }
  attempt=$((attempt + 1))
  sleep 3
done

exec node Sobree/api/dist/server.js
