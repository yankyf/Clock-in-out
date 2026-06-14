# Clock In/Out

An offline-first time-tracking platform that replaces the original Google Sheet
+ Apps Script workflow. It has two faces sharing one backend:

- **Web admin platform** — view, edit, add and delete time entries online
  (the "sheet" you can read & edit from anywhere).
- **Native desktop app (Electron)** — a focused clock in/out client that
  **works fully offline** and **syncs** to the platform whenever it's online.

Everything is TypeScript, in an npm-workspaces monorepo.

## What it carries over from the sheet

| Sheet concept | Here |
| --- | --- |
| A row = Date / Clock in / Clock out | `TimeEntry` (real ISO timestamps, no midnight ambiguity) |
| Column D "Total Hours" formula | `computeEntryHours()` in `@clock/shared` |
| Column F "Babysitter" checkbox → +30 min (column E) | `babysitterBonus` flag |
| Categories "Work" / "Babysitter" | `category` (`WORK` \| `BABYSITTER`) |
| Per-category $/hour (cells I8 / L8: $33 / $8) | `Rate` model + seeded defaults |
| `clockIn` / `clockOut` Apps Script buttons | Desktop "Clock in / Clock out" |
| `rewriteRowData` / `insertNewRowFromInputs` | Web table inline edit / add |

## Architecture

```
packages/
  shared/   Domain types + hours/pay calculations (the sheet's formulas). Tested.
  server/   Express + Prisma API: auth (JWT), entries CRUD, offline sync engine.
  web/      React + Vite admin platform (login + editable entries table).
  desktop/  Electron app: local SQLite store + push/pull sync engine.
```

**Sync model (offline-first):** every entry has a client-generated `id`, an
`updatedAt`, and a `deleted` tombstone. The desktop writes locally first
(marking rows *dirty*), then a background loop does **push-then-pull** with
**last-write-wins** on `updatedAt`. Deletions and edits propagate both ways.

## Run it locally

Prereqs: Node ≥ 20.

```bash
npm install
npm run build:shared              # other packages consume @clock/shared

# --- server ---
cd packages/server
cp .env.example .env              # dev defaults use a local SQLite file
npx prisma db push                # create the schema
npm run seed                      # creates the OWNER account + default rates
npm run dev                       # http://localhost:4000

# --- web admin (new terminal) ---
npm run dev -w @clock/web         # http://localhost:5173

# --- desktop clock-in (new terminal) ---
npm run dev -w @clock/desktop     # builds + launches Electron
```

Default seed login (change via `SEED_OWNER_*` in `.env`):
`owner@example.com` / `changeme123`.

> The desktop app's `postinstall` rebuilds `better-sqlite3` for Electron. If the
> native module complains, run `npx electron-rebuild -f -w better-sqlite3` in
> `packages/desktop`.

## Going to production

- **Database:** switch `provider` in `packages/server/prisma/schema.prisma` to
  `postgresql` and point `DATABASE_URL` at your Postgres. No model changes.
- **Secrets:** set a strong `JWT_SECRET` (the server refuses to boot in
  production with the dev default).
- **Web:** `npm run build -w @clock/web` → static bundle; set `VITE_API_URL`.
- **Desktop:** package with electron-builder; set `CLOCK_SERVER_URL` (or enter
  the server URL on the login screen).

## Status — thin slice (this commit)

Done end-to-end: auth, clock in/out, offline local storage, push/pull sync,
and an editable web table. Verified with unit tests + a live API run.

### Next (the rest of the sheet)
- Rates editor + monthly and date-range pay reports (sheet panels H–L).
- Invoice generation (the sheet's second tab → PDF/printable).
- Multi-user admin: invite workers, review everyone's entries (the data model
  is already multi-user-ready).
- Edit/correct entries from the desktop app while offline.

See `docs/original-sheet.md` for the full mapping of the source spreadsheet and
Apps Script.
