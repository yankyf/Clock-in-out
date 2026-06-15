// Plain renderer script (no imports/exports so tsc emits a browser-loadable
// script under CommonJS). All privileged work goes through window.clockApi,
// exposed by preload.ts.

interface Entry {
  id: string;
  category: string;
  clockIn: string;
  clockOut: string | null;
  babysitterBonus: boolean;
  note: string | null;
}
interface State {
  serverUrl: string;
  loggedIn: boolean;
  user: { name: string; email: string } | null;
  openEntry: Entry | null;
  entries: Entry[];
  pendingSync: number;
}
interface EntryFields {
  category: string;
  clockIn: string;
  clockOut: string | null;
  babysitterBonus: boolean;
  note: string | null;
}
interface ClockApi {
  getState(): Promise<State>;
  login(serverUrl: string, email: string, password: string): Promise<State>;
  logout(): Promise<State>;
  clockIn(category: string): Promise<State>;
  clockOut(): Promise<State>;
  addEntry(fields: EntryFields): Promise<State>;
  updateEntry(args: { id: string } & EntryFields): Promise<State>;
  deleteEntry(id: string): Promise<State>;
  syncNow(): Promise<{ ok: boolean; error?: string }>;
  onState(cb: (s: State) => void): () => void;
}

const api: ClockApi = (window as unknown as { clockApi: ClockApi }).clockApi;
const app = document.getElementById("app")!;

let state: State | null = null;
let lastError = "";

// Edit state: `id` null means "adding a new past entry".
interface Draft {
  id: string | null;
  category: string;
  clockIn: string; // datetime-local
  clockOut: string; // datetime-local
  babysitterBonus: boolean;
  note: string;
}
let draft: Draft | null = null;

function fmtDuration(fromIso: string): string {
  const mins = Math.floor((Date.now() - new Date(fromIso).getTime()) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function online(): boolean {
  return navigator.onLine;
}

// ---- datetime-local <-> ISO -------------------------------------------------
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function localToIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
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
    ${draft ? editView(draft) : ""}
    <div class="card">
      <div class="rowbetween">
        <strong>Recent</strong>
        ${draft ? "" : `<button class="linkbtn" id="addBtn">+ Add past entry</button>`}
      </div>
      <table>
        <thead><tr><th>Category</th><th>In</th><th>Out</th><th></th></tr></thead>
        <tbody>
          ${s.entries
            .map(
              (e) => `<tr>
                <td>${e.category}${e.babysitterBonus ? " +30m" : ""}</td>
                <td>${new Date(e.clockIn).toLocaleString()}</td>
                <td>${e.clockOut ? new Date(e.clockOut).toLocaleTimeString() : "—"}</td>
                <td class="rowactions">
                  <button class="linkbtn editBtn" data-id="${e.id}">Edit</button>
                  <button class="linkbtn danger delBtn" data-id="${e.id}">Del</button>
                </td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function editView(d: Draft): string {
  return `
    <div class="card editcard">
      <strong>${d.id ? "Edit entry" : "Add past entry"}</strong>
      <label style="margin-top:.5rem">Category</label>
      <select id="d_category">
        <option value="WORK" ${d.category === "WORK" ? "selected" : ""}>Work</option>
        <option value="BABYSITTER" ${d.category === "BABYSITTER" ? "selected" : ""}>Babysitter</option>
      </select>
      <label style="margin-top:.5rem">Clock in</label>
      <input id="d_clockIn" type="datetime-local" value="${escapeAttr(d.clockIn)}" />
      <label style="margin-top:.5rem">Clock out</label>
      <input id="d_clockOut" type="datetime-local" value="${escapeAttr(d.clockOut)}" />
      <label style="margin-top:.5rem; flex-direction:row; align-items:center; gap:.4rem">
        <input id="d_bonus" type="checkbox" style="width:auto" ${d.babysitterBonus ? "checked" : ""} /> Babysitter +30m bonus
      </label>
      <label style="margin-top:.5rem">Note</label>
      <input id="d_note" type="text" value="${escapeAttr(d.note)}" />
      <div class="row" style="margin-top:.75rem">
        <button class="primary" id="saveBtn">Save</button>
        <button class="linkbtn" id="cancelBtn">Cancel</button>
      </div>
    </div>`;
}

function readDraftFromForm(): Draft {
  return {
    id: draft?.id ?? null,
    category: (byId("d_category") as HTMLSelectElement).value,
    clockIn: (byId("d_clockIn") as HTMLInputElement).value,
    clockOut: (byId("d_clockOut") as HTMLInputElement).value,
    babysitterBonus: (byId("d_bonus") as HTMLInputElement).checked,
    note: (byId("d_note") as HTMLInputElement).value,
  };
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

  // ---- editing ----
  byId("addBtn")?.addEventListener("click", () => {
    draft = {
      id: null,
      category: "WORK",
      clockIn: isoToLocal(new Date().toISOString()),
      clockOut: "",
      babysitterBonus: false,
      note: "",
    };
    lastError = "";
    render();
  });
  byId("cancelBtn")?.addEventListener("click", () => {
    draft = null;
    lastError = "";
    render();
  });
  byId("saveBtn")?.addEventListener("click", async () => {
    const d = readDraftFromForm();
    const fields: EntryFields = {
      category: d.category,
      clockIn: localToIso(d.clockIn) ?? "",
      clockOut: localToIso(d.clockOut),
      babysitterBonus: d.babysitterBonus,
      note: d.note || null,
    };
    lastError = "";
    try {
      state = d.id
        ? await api.updateEntry({ id: d.id, ...fields })
        : await api.addEntry(fields);
      draft = null;
    } catch (e) {
      lastError = errMsg(e);
    }
    render();
  });
  document.querySelectorAll<HTMLElement>(".editBtn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.id!;
      const e = state?.entries.find((x) => x.id === id);
      if (!e) return;
      draft = {
        id: e.id,
        category: e.category,
        clockIn: isoToLocal(e.clockIn),
        clockOut: isoToLocal(e.clockOut),
        babysitterBonus: e.babysitterBonus,
        note: e.note ?? "",
      };
      lastError = "";
      render();
    }),
  );
  document.querySelectorAll<HTMLElement>(".delBtn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this entry?")) return;
      lastError = "";
      try {
        state = await api.deleteEntry(btn.dataset.id!);
      } catch (e) {
        lastError = errMsg(e);
      }
      render();
    }),
  );
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
  if (state?.openEntry && !draft) render();
}, 30_000);

api.onState((s) => {
  // Don't clobber an in-progress edit when a background sync pushes new state.
  state = s;
  if (!draft) render();
});
api.getState().then((s) => {
  state = s;
  render();
});
