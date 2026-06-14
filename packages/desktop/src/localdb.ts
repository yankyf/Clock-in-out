import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { TimeEntry } from "@clock/shared";

/**
 * Local offline store for the desktop client (SQLite via better-sqlite3).
 *
 * Mirrors the server's TimeEntry table, plus two sync-only columns:
 *  - `dirty`: 1 when the row has local changes not yet acknowledged by the
 *    server. Cleared after a successful push.
 *  - a `meta` table holds the `lastPull` cursor (server time) and the saved
 *    session (server URL, token, user).
 *
 * Everything here works with the network down; `sync.ts` reconciles later.
 */
export class LocalDb {
  private db: Database.Database;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(path.join(dataDir, "clock.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        category TEXT NOT NULL,
        clockIn TEXT NOT NULL,
        clockOut TEXT,
        babysitterBonus INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        updatedAt TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        dirty INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
  }

  // ---- meta -----------------------------------------------------------------
  getMeta(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }
  setMeta(key: string, value: string) {
    this.db
      .prepare("INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, value);
  }

  // ---- local writes (mark dirty) -------------------------------------------
  /** Insert/replace a locally-originated change. Bumps updatedAt, sets dirty. */
  putLocal(entry: TimeEntry) {
    this.upsertRow(entry, 1);
  }

  /** Apply a server-originated row (last-write-wins, never marks dirty). */
  applyServer(entry: TimeEntry) {
    const existing = this.get(entry.id);
    if (existing && new Date(existing.updatedAt) > new Date(entry.updatedAt)) {
      return; // local copy is newer; keep it (it's still dirty, will re-push)
    }
    this.upsertRow(entry, 0);
  }

  private upsertRow(e: TimeEntry, dirty: 0 | 1) {
    this.db
      .prepare(
        `INSERT INTO entries (id, userId, category, clockIn, clockOut, babysitterBonus, note, updatedAt, deleted, dirty)
         VALUES (@id, @userId, @category, @clockIn, @clockOut, @babysitterBonus, @note, @updatedAt, @deleted, @dirty)
         ON CONFLICT(id) DO UPDATE SET
           userId=excluded.userId, category=excluded.category, clockIn=excluded.clockIn,
           clockOut=excluded.clockOut, babysitterBonus=excluded.babysitterBonus, note=excluded.note,
           updatedAt=excluded.updatedAt, deleted=excluded.deleted, dirty=excluded.dirty`,
      )
      .run({
        ...e,
        babysitterBonus: e.babysitterBonus ? 1 : 0,
        deleted: e.deleted ? 1 : 0,
        dirty,
      });
  }

  // ---- reads ----------------------------------------------------------------
  get(id: string): TimeEntry | null {
    const row = this.db.prepare("SELECT * FROM entries WHERE id = ?").get(id);
    return row ? this.rowToEntry(row) : null;
  }

  all(): TimeEntry[] {
    const rows = this.db
      .prepare("SELECT * FROM entries WHERE deleted = 0 ORDER BY clockIn DESC")
      .all();
    return rows.map((r) => this.rowToEntry(r));
  }

  /** The currently open shift for a user (clocked in, not out), if any. */
  openEntry(userId: string): TimeEntry | null {
    const row = this.db
      .prepare(
        "SELECT * FROM entries WHERE userId = ? AND clockOut IS NULL AND deleted = 0 ORDER BY clockIn DESC LIMIT 1",
      )
      .get(userId);
    return row ? this.rowToEntry(row) : null;
  }

  dirty(): TimeEntry[] {
    const rows = this.db.prepare("SELECT * FROM entries WHERE dirty = 1").all();
    return rows.map((r) => this.rowToEntry(r));
  }

  markSynced(ids: string[]) {
    const stmt = this.db.prepare("UPDATE entries SET dirty = 0 WHERE id = ?");
    const tx = this.db.transaction((list: string[]) => list.forEach((id) => stmt.run(id)));
    tx(ids);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToEntry(r: any): TimeEntry {
    return {
      id: r.id,
      userId: r.userId,
      category: r.category,
      clockIn: r.clockIn,
      clockOut: r.clockOut,
      babysitterBonus: !!r.babysitterBonus,
      note: r.note,
      updatedAt: r.updatedAt,
      deleted: !!r.deleted,
    };
  }
}
