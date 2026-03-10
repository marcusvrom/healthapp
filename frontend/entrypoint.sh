#!/bin/sh
# Generates /app/src/assets/env.js at container startup with the runtime API URL.
# Served as /env.js by ng serve (via assets config) or nginx (via root).
# Usage: set API_URL env var before running this container.

API_URL="${API_URL:-http://localhost:3000}"

cat > /app/src/assets/env.js << EOF
window.__env__ = {
  apiUrl: '${API_URL}/api/v1'
};
EOF

echo "[entrypoint] API_URL set to: ${API_URL}/api/v1"

exec "$@"
