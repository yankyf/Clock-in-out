import { useEffect, useState } from "react";
import type { Role, User } from "@clock/shared";
import { api } from "../api.js";

const ROLES: Role[] = ["WORKER", "ADMIN", "OWNER"];

export function Team({
  currentUser,
  onUsersChanged,
}: {
  currentUser: User;
  onUsersChanged: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // new-user form
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("WORKER");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setUsers(await api.listUsers());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createUser({ email, name, role, password });
      setEmail("");
      setName("");
      setRole("WORKER");
      setPassword("");
      await refresh();
      onUsersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(u: User, newRole: Role) {
    setError(null);
    try {
      await api.updateUser(u.id, { role: newRole });
      await refresh();
      onUsersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function resetPassword(u: User) {
    const pw = prompt(`New password for ${u.name} (min 6 chars):`);
    if (!pw) return;
    try {
      await api.updateUser(u.id, { password: pw });
      alert("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2>Team</h2>
      {error && <div className="error">{error}</div>}

      <form className="card" onSubmit={addUser} style={{ maxWidth: 620 }}>
        <strong>Add a person</strong>
        <div className="row" style={{ flexWrap: "wrap", marginTop: "0.5rem" }}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="Temp password (min 6)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add user"}
          </button>
        </div>
      </form>

      <table className="grid" style={{ marginTop: "1rem" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={5} className="muted">
                Loading…
              </td>
            </tr>
          )}
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                {u.name}
                {u.id === currentUser.id ? " (me)" : ""}
              </td>
              <td>{u.email}</td>
              <td>
                <select
                  value={u.role}
                  disabled={u.id === currentUser.id}
                  title={u.id === currentUser.id ? "You can't change your own role" : undefined}
                  onChange={(e) => changeRole(u, e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="actions">
                <button className="link" onClick={() => resetPassword(u)}>
                  Reset password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
