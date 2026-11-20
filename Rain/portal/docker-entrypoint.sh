#!/bin/sh
set -eu

API_URL="${VITE_API_URL:-http://localhost:4000}"
AGENT_URL="${VITE_AGENT_URL:-http://127.0.0.1:47821}"

# Escape backslashes and double quotes for safe JS string literal embedding
escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

cat <<EOF > /usr/share/nginx/html/env-config.js
window.__MANGO_ENV__ = {
  VITE_API_URL: "$(escape_js "$API_URL")",
  VITE_AGENT_URL: "$(escape_js "$AGENT_URL")"
};
EOF
