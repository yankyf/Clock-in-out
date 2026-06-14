# Production image: builds @clock/shared + @clock/web + @clock/server and runs
# the API server, which also serves the web admin from the same origin.
# The Electron desktop package is intentionally NOT built here.
FROM node:20-bookworm-slim

WORKDIR /app

# Prisma needs OpenSSL at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- dependency install (only the three server-side workspaces) -------------
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
# --ignore-scripts skips the desktop's electron/better-sqlite3 native build.
# --include=dev keeps build tools (tsc, vite, prisma). We must NOT pass
# --omit=optional: Rollup ships its Linux binary as an optional dependency,
# and Vite's build fails without it.
RUN npm install --include-workspace-root --include=dev --ignore-scripts \
  -w @clock/shared -w @clock/server -w @clock/web

# --- build ------------------------------------------------------------------
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY packages/web packages/web

RUN npm run build -w @clock/shared \
  && DATABASE_URL="file:./build.db" npx prisma generate --schema packages/server/prisma/schema.prisma \
  && VITE_API_URL="" npm run build -w @clock/web \
  && npm run build -w @clock/server

COPY scripts/docker-start.sh ./scripts/docker-start.sh
RUN chmod +x ./scripts/docker-start.sh

# Defaults (override in your host's env). DATABASE_URL here is ephemeral SQLite;
# point it at Postgres for durable data (see DEPLOY.md).
ENV NODE_ENV=production \
    DATABASE_URL="file:./dev.db" \
    PORT=10000 \
    WEB_DIST=/app/packages/web/dist

EXPOSE 10000
CMD ["./scripts/docker-start.sh"]
