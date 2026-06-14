import { useEffect, useState } from "react";
import type { User } from "@clock/shared";
import { api, getToken, setToken } from "./api.js";
import { Login } from "./pages/Login.js";
import { Entries } from "./pages/Entries.js";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center muted">Loading…</div>;

  if (!user) {
    return <Login onLoggedIn={setUser} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong>Clock In/Out</strong>
        <span className="muted">Admin platform</span>
        <div className="spacer" />
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
        <Entries />
      </main>
    </div>
  );
}
