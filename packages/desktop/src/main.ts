import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Category, TimeEntry, User } from "@clock/shared";
import { LocalDb } from "./localdb.js";
import { SyncEngine } from "./sync.js";

const DEFAULT_SERVER_URL = process.env.CLOCK_SERVER_URL ?? "http://localhost:4000";
const SYNC_INTERVAL_MS = 30_000;

let win: BrowserWindow | null = null;
let db: LocalDb;
let sync: SyncEngine;

interface Session {
  serverUrl: string;
  token: string;
  user: User;
}

function loadSession(): Session | null {
  const raw = db.getMeta("session");
  return raw ? (JSON.parse(raw) as Session) : null;
}
function saveSession(s: Session | null) {
  if (s) db.setMeta("session", JSON.stringify(s));
  else db.setMeta("session", "");
}

/** Snapshot the renderer needs to draw the whole UI. */
function buildState() {
  const session = loadSession();
  const open = session ? db.openEntry(session.user.id) : null;
  return {
    serverUrl: session?.serverUrl ?? DEFAULT_SERVER_URL,
    loggedIn: !!session,
    user: session?.user ?? null,
    openEntry: open,
    entries: db.all().slice(0, 50),
    pendingSync: db.dirty().length,
  };
}

function pushState() {
  win?.webContents.send("state", buildState());
}

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 680,
    title: "Clock In/Out",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  db = new LocalDb(path.join(app.getPath("userData"), "data"));
  sync = new SyncEngine(db, () => {
    const s = loadSession();
    return s ? { serverUrl: s.serverUrl, token: s.token } : null;
  });

  registerIpc();
  createWindow();

  // Best-effort background sync; ignore offline errors.
  setInterval(() => {
    if (loadSession()) trySync();
  }, SYNC_INTERVAL_MS);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

async function trySync(): Promise<{ ok: boolean; error?: string }> {
  try {
    await sync.sync();
    pushState();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function registerIpc() {
  ipcMain.handle("get-state", () => buildState());

  ipcMain.handle("login", async (_e, args: { serverUrl: string; email: string; password: string }) => {
    const resp = await SyncEngine.login(args.serverUrl, args.email, args.password);
    saveSession({ serverUrl: args.serverUrl, token: resp.token, user: resp.user });
    await trySync();
    pushState();
    return buildState();
  });

  ipcMain.handle("logout", () => {
    saveSession(null);
    pushState();
    return buildState();
  });

  ipcMain.handle("clock-in", (_e, args: { category: Category }) => {
    const session = loadSession();
    if (!session) throw new Error("Not logged in");
    if (db.openEntry(session.user.id)) throw new Error("Already clocked in");

    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: randomUUID(),
      userId: session.user.id,
      category: args.category,
      clockIn: now,
      clockOut: null,
      babysitterBonus: args.category === "BABYSITTER",
      note: null,
      updatedAt: now,
      deleted: false,
    };
    db.putLocal(entry);
    pushState();
    trySync();
    return buildState();
  });

  ipcMain.handle("clock-out", () => {
    const session = loadSession();
    if (!session) throw new Error("Not logged in");
    const open = db.openEntry(session.user.id);
    if (!open) throw new Error("Not clocked in");

    const now = new Date().toISOString();
    db.putLocal({ ...open, clockOut: now, updatedAt: now });
    pushState();
    trySync();
    return buildState();
  });

  // ---- offline entry editing -----------------------------------------------
  // All of these write to the local store first (offline-safe); the sync
  // engine reconciles with the server in the background.

  type EntryFields = {
    category: Category;
    clockIn: string; // ISO
    clockOut: string | null; // ISO
    babysitterBonus: boolean;
    note: string | null;
  };

  function validateFields(f: EntryFields) {
    if (!f.clockIn || Number.isNaN(Date.parse(f.clockIn))) throw new Error("Clock in is required");
    if (f.clockOut && Number.isNaN(Date.parse(f.clockOut))) throw new Error("Invalid clock out");
    if (f.clockOut && new Date(f.clockOut) < new Date(f.clockIn)) {
      throw new Error("Clock out is before clock in");
    }
  }

  ipcMain.handle("add-entry", (_e, fields: EntryFields) => {
    const session = loadSession();
    if (!session) throw new Error("Not logged in");
    validateFields(fields);
    const now = new Date().toISOString();
    db.putLocal({
      id: randomUUID(),
      userId: session.user.id,
      category: fields.category,
      clockIn: fields.clockIn,
      clockOut: fields.clockOut,
      babysitterBonus: fields.babysitterBonus,
      note: fields.note,
      updatedAt: now,
      deleted: false,
    });
    pushState();
    trySync();
    return buildState();
  });

  ipcMain.handle("update-entry", (_e, args: { id: string } & EntryFields) => {
    const session = loadSession();
    if (!session) throw new Error("Not logged in");
    const existing = db.get(args.id);
    if (!existing) throw new Error("Entry not found");
    if (existing.userId !== session.user.id) throw new Error("Not your entry");
    validateFields(args);
    db.putLocal({
      ...existing,
      category: args.category,
      clockIn: args.clockIn,
      clockOut: args.clockOut,
      babysitterBonus: args.babysitterBonus,
      note: args.note,
      updatedAt: new Date().toISOString(),
    });
    pushState();
    trySync();
    return buildState();
  });

  ipcMain.handle("delete-entry", (_e, args: { id: string }) => {
    const session = loadSession();
    if (!session) throw new Error("Not logged in");
    const existing = db.get(args.id);
    if (!existing) throw new Error("Entry not found");
    if (existing.userId !== session.user.id) throw new Error("Not your entry");
    db.putLocal({ ...existing, deleted: true, updatedAt: new Date().toISOString() });
    pushState();
    trySync();
    return buildState();
  });

  ipcMain.handle("sync-now", () => trySync());
}
