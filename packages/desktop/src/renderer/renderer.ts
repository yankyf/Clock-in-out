// Plain renderer script (no imports/exports so tsc emits a browser-loadable
// script under CommonJS). All privileged work goes through window.clockApi,
// exposed by preload.ts.

interface Entry {
  id: string;
  category: string;
  clockIn: string;
  clockOut: string | null;
  babysitterBonus: boolean;
}
interface State {
  serverUrl: string;
  loggedIn: boolean;
  user: { name: string; email: string } | null;
  openEntry: Entry | null;
  entries: Entry[];
  pendingSync: number;
}
interface ClockApi {
  getState(): Promise<State>;
  login(serverUrl: string, email: string, password: string): Promise<State>;
  logout(): Promise<State>;
  clockIn(category: string): Promise<State>;
  clockOut(): Promise<State>;
  syncNow(): Promise<{ ok: boolean; error?: string }>;
  onState(cb: (s: State) => void): () => void;
}

const api: ClockApi = (window as unknown as { clockApi: ClockApi }).clockApi;
const app = document.getElementById("app")!;

let state: State | null = null;
let lastError = "";

function fmtDuration(fromIso: string): string {
  const mins = Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function online(): boolean {
  return navigator.onLine;
}

function render() {
  if (!state) {
    app.innerHTML = `<p class="muted">Loading…</p>`;
    return;
  }
  app.innerHTML = state.loggedIn ? clockView(state) : loginView(state);
  wire();
}

function loginView(s: State): string {
  return `
    <h1>Clock In/Out</h1>
    <p class="muted">Sign in to your account</p>
    <div class="card">
      <label>Server URL</label>
      <input id="serverUrl" value="${escapeAttr(s.serverUrl)}" />
      <label style="margin-top:.75rem">Email</label>
      <input id="email" type="email" />
      <label style="margin-top:.75rem">Password</label>
      <input id="password" type="password" />
      <button class="primary big" id="loginBtn" style="margin-top:1rem">Sign in</button>
      ${lastError ? `<div class="error">${escapeHtml(lastError)}</div>` : ""}
    </div>`;
}

function clockView(s: State): string {
  const open = s.openEntry;
  const conn = online() ? `<span class="dot on"></span> Online` : `<span class="dot off"></span> Offline`;
  const action = open
    ? `<div class="big-timer">${fmtDuration(open.clockIn)}</div>
       <p class="muted">Clocked in as ${open.category} since ${new Date(open.clockIn).toLocaleTimeString()}</p>
       <button class="clockout big" id="clockOutBtn">Clock out</button>`
    : `<label>Category</label>
       <select id="category">
         <option value="WORK">Work</option>
         <option value="BABYSITTER">Babysitter</option>
       </select>
       <button class="clockin big" id="clockInBtn" style="margin-top:.75rem">Clock in</button>`;

  return `
    <h1>Hi, ${escapeHtml(s.user?.name ?? "")}</h1>
    <div class="status muted">${conn} · ${s.pendingSync} pending sync · <button class="linkbtn" id="syncBtn">Sync now</button> · <button class="linkbtn" id="logoutBtn">Sign out</button></div>
    <div class="card">${action}${lastError ? `<div class="error">${escapeHtml(lastError)}</div>` : ""}</div>
    <div class="card">
      <strong>Recent</strong>
      <table>
        <thead><tr><th>Category</th><th>In</th><th>Out</th></tr></thead>
        <tbody>
          ${s.entries
            .map(
              (e) => `<tr>
                <td>${e.category}${e.babysitterBonus ? " +30m" : ""}</td>
                <td>${new Date(e.clockIn).toLocaleString()}</td>
                <td>${e.clockOut ? new Date(e.clockOut).toLocaleTimeString() : "—"}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function wire() {
  byId("loginBtn")?.addEventListener("click", async () => {
    lastError = "";
    try {
      state = await api.login(
        (byId("serverUrl") as HTMLInputElement).value.trim(),
        (byId("email") as HTMLInputElement).value.trim(),
        (byId("password") as HTMLInputElement).value,
      );
    } catch (e) {
      lastError = errMsg(e);
    }
    render();
  });
  byId("logoutBtn")?.addEventListener("click", async () => {
    state = await api.logout();
    render();
  });
  byId("clockInBtn")?.addEventListener("click", async () => {
    lastError = "";
    try {
      state = await api.clockIn((byId("category") as HTMLSelectElement).value);
    } catch (e) {
      lastError = errMsg(e);
    }
    render();
  });
  byId("clockOutBtn")?.addEventListener("click", async () => {
    lastError = "";
    try {
      state = await api.clockOut();
    } catch (e) {
      lastError = errMsg(e);
    }
    render();
  });
  byId("syncBtn")?.addEventListener("click", async () => {
    const r = await api.syncNow();
    lastError = r.ok ? "" : r.error ?? "Sync failed (offline?)";
    render();
  });
}

// ---- helpers ----------------------------------------------------------------
function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// Live tick so the "clocked in" timer updates, and connectivity changes redraw.
window.addEventListener("online", render);
window.addEventListener("offline", render);
setInterval(() => {
  if (state?.openEntry) render();
}, 30_000);

api.onState((s) => {
  state = s;
  render();
});
api.getState().then((s) => {
  state = s;
  render();
});
