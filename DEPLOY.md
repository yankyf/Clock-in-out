# Deploying to a public URL

The repo ships a `Dockerfile` (builds the API + web admin into one image,
served on a single port) and a `render.yaml` Blueprint. Any Docker host works;
**Render's free tier** is the quickest no-credit-card option.

## Option A — Render Blueprint (recommended, ~3 minutes)

1. Push this branch to GitHub (already done).
2. Go to <https://dashboard.render.com> → **New** → **Blueprint**.
3. Connect the `yankyf/Clock-in-out` repo and pick this branch.
4. Render detects `render.yaml`. It will **prompt for `SEED_OWNER_PASSWORD`** —
   enter a password you'll use to log in.
5. Click **Apply**. First build takes a few minutes.
6. You get a URL like `https://clock-in-out-xxxx.onrender.com`. Open it and log
   in with `owner@example.com` + the password you chose.

> Free tier notes: the service sleeps after inactivity (first request after a
> nap is slow), and the SQLite database is **ephemeral** — it resets on each
> deploy/restart. Fine for a live demo. For durable data, use Postgres (below).

## Option B — any Docker host (Railway, Fly.io, Cloud Run, a VPS…)

```bash
docker build -t clock-in-out .
docker run -p 8080:10000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e SEED_OWNER_EMAIL="owner@example.com" \
  -e SEED_OWNER_PASSWORD="choose-one" \
  clock-in-out
# open http://localhost:8080
```

## Durable data (Postgres)

SQLite is the zero-config default. For data that survives restarts:

1. In `packages/server/prisma/schema.prisma`, set
   `datasource db { provider = "postgresql" }`.
2. Set `DATABASE_URL` to your Postgres connection string (Render/Railway can
   provision one and inject it).
3. Redeploy. `prisma db push` on boot creates the tables.

## The desktop app

The desktop clock-in client is a separate Electron build (it talks to whatever
server URL you enter on its login screen, or `CLOCK_SERVER_URL`). Package it
with electron-builder when you want distributable installers — it is not part
of the web deployment.
