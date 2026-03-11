# ── Stage 1: Build Angular app ────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline

COPY . .

# Placeholder env.js so the build doesn't fail on a missing asset.
# The real file is generated at container start by entrypoint.sh.
RUN mkdir -p src/assets && \
    echo "window.__env__ = { apiUrl: '' };" > src/assets/env.js

# Production build enables service-worker via ngsw-config.json
RUN npm run build:prod

# ── Stage 2: Serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove the default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Angular 17+ application builder outputs to dist/<name>/browser
COPY --from=builder /app/dist/healthapp/browser /usr/share/nginx/html

# SPA-friendly nginx config with PWA caching rules
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint writes env.js with the runtime API_URL before nginx starts
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
