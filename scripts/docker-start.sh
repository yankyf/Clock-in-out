#!/usr/bin/env sh
set -e

# Sync the schema to the database, seed the initial OWNER (idempotent), then
# start the server. Works for both SQLite and Postgres DATABASE_URLs.
npx prisma db push --schema packages/server/prisma/schema.prisma --skip-generate
node packages/server/dist/seed.js
exec node packages/server/dist/index.js
