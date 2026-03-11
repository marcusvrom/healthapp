#!/bin/sh
# Injects the runtime API URL into env.js before nginx starts.
# Set the API_URL env var when running this container (defaults to localhost).
# The Angular app reads window.__env__.apiUrl to reach the backend.

API_URL="${API_URL:-http://localhost:3000}"

cat > /usr/share/nginx/html/env.js << EOF
window.__env__ = {
  apiUrl: '${API_URL}/api/v1'
};
EOF

echo "[entrypoint] API_URL set to: ${API_URL}/api/v1"

exec "$@"
