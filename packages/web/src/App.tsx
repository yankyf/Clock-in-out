import { useEffect, useState } from "react";
import type { User } from "@clock/shared";
import { api, getToken, setToken } from "./api.js";
import { Login } from "./pages/Login.js";
import { Entries } from "./pages/Entries.js";
import { Reports } from "./pages/Reports.js";
import { Team } from "./pages/Team.js";
import { Download } from "./pages/Download.js";

type Tab = "entries" | "reports" | "team" | "download";

const isAdminRole = (u: User) => u.role === "OWNER" || u.role === "ADMIN";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("entries");

  // Admin-only "viewing as": which user's data the Entries/Reports tabs show.
  const [users, setUsers] = useState<User[]>([]);
  const [viewUserId, setViewUserId] = useState<string>("");

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        setViewUserId(u.id);
        if (isAdminRole(u)) api.listUsers().then(setUsers).catch(() => {});
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onLoggedIn={onLoggedIn} />;

  function onLoggedIn(u: User) {
    setUser(u);
    setViewUserId(u.id);
    if (isAdminRole(u)) api.listUsers().then(setUsers).catch(() => {});
  }

  const admin = isAdminRole(user);

  return (
    <div className="app">
      <header className="topbar">
        <img src="/logo-light.svg" alt="" className="logo" />
        <strong>Clock In/Out</strong>
        <nav className="tabs">
          <button className={tab === "entries" ? "tab active" : "tab"} onClick={() => setTab("entries")}>
            Entries
          </button>
          <button className={tab === "reports" ? "tab active" : "tab"} onClick={() => setTab("reports")}>
            Reports &amp; pay
          </button>
          {admin && (
            <button className={tab === "team" ? "tab active" : "tab"} onClick={() => setTab("team")}>
              Team
            </button>
          )}
          <button className={tab === "download" ? "tab active" : "tab"} onClick={() => setTab("download")}>
            Download app
          </button>
        </nav>
        <div className="spacer" />
        {admin && (tab === "entries" || tab === "reports") && (
          <label className="viewas">
            Viewing as
            <select value={viewUserId} onChange={(e) => setViewUserId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.id === user.id ? " (me)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="muted">
          {user.name} · {user.role}
        </span>
        <button
          className="link"
          onClick={() => {
            setToken(null);
            setUser(null);
          }}
        >
          Sign out
        </button>
      </header>
      <main className="content">
        {tab === "entries" && (
          <Entries viewUserId={viewUserId || user.id} canActForOther={admin && viewUserId !== user.id} />
        )}
        {tab === "reports" && <Reports viewUserId={viewUserId || user.id} canEditRates={admin} />}
        {tab === "team" && (
          <Team
            currentUser={user}
            onUsersChanged={() => api.listUsers().then(setUsers).catch(() => {})}
          />
        )}
        {tab === "download" && <Download />}
      </main>
    </div>
  );
}
