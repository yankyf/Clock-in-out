import type {
  LoginResponse,
  SyncPullResponse,
  SyncPushResponse,
  TimeEntry,
} from "@clock/shared";
import type { LocalDb } from "./localdb.js";

/**
 * Sync engine (desktop side). A full sync is push-then-pull:
 *   1. PUSH all dirty rows; mark them clean on success.
 *   2. PULL everything changed since our saved cursor; apply with last-write-wins.
 *
 * All methods no-op gracefully when offline (fetch throws) so the UI keeps
 * working; the caller just reports "offline / N pending".
 */
export class SyncEngine {
  constructor(
    private db: LocalDb,
    private getSession: () => { serverUrl: string; token: string } | null,
  ) {}

  static async login(serverUrl: string, email: string, password: string): Promise<LoginResponse> {
    const url = serverUrl.trim().replace(/\/+$/, ""); // tolerate trailing slashes
    let res: Response;
    try {
      res = await fetch(`${url}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        // Free hosting tiers can take ~50s to wake from sleep on the first hit.
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      const detail = cause?.code || cause?.message || (e as Error).message;
      throw new Error(
        `Can't reach the server at ${url} — ${detail}. ` +
          `Check the Server URL (it should start with https://) and that you're online. ` +
          `If it's a free host, open the URL in a browser once to wake it, then retry.`,
      );
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Login failed (HTTP ${res.status})`);
    }
    return (await res.json()) as LoginResponse;
  }

  async sync(): Promise<{ pushed: number; pulled: number }> {
    const session = this.getSession();
    if (!session) throw new Error("Not logged in");
    const pushed = await this.push(session);
    const pulled = await this.pull(session);
    return { pushed, pulled };
  }

  private async push(session: { serverUrl: string; token: string }): Promise<number> {
    const dirty = this.db.dirty();
    if (dirty.length === 0) return 0;

    const res = await fetch(`${session.serverUrl}/sync/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ entries: dirty }),
    });
    if (!res.ok) throw new Error(`Push failed (${res.status})`);

    const data = (await res.json()) as SyncPushResponse;
    // Mark every pushed row clean; the pull below reconciles any the server
    // rejected (because its copy was newer) back into our local store.
    this.db.markSynced(dirty.map((e: TimeEntry) => e.id));
    return data.applied.length;
  }

  private async pull(session: { serverUrl: string; token: string }): Promise<number> {
    const since = this.db.getMeta("lastPull") ?? new Date(0).toISOString();
    const res = await fetch(`${session.serverUrl}/sync/pull?since=${encodeURIComponent(since)}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (!res.ok) throw new Error(`Pull failed (${res.status})`);

    const data = (await res.json()) as SyncPullResponse;
    for (const entry of data.entries) {
      this.db.applyServer(entry);
    }
    this.db.setMeta("lastPull", data.serverTime);
    return data.entries.length;
  }
}
