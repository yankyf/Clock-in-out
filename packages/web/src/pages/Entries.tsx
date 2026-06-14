import { useEffect, useMemo, useState } from "react";
import {
  computeEntryHours,
  formatHours,
  sumPayableHours,
  type Category,
  type TimeEntry,
} from "@clock/shared";
import { api } from "../api.js";

// ---- datetime-local <-> ISO helpers ----------------------------------------
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localInputToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

interface Draft {
  id: string;
  category: Category;
  clockIn: string; // datetime-local
  clockOut: string; // datetime-local
  babysitterBonus: boolean;
  note: string;
}

function entryToDraft(e: TimeEntry): Draft {
  return {
    id: e.id,
    category: e.category,
    clockIn: isoToLocalInput(e.clockIn),
    clockOut: isoToLocalInput(e.clockOut),
    babysitterBonus: e.babysitterBonus,
    note: e.note ?? "",
  };
}

function newDraft(): Draft {
  return {
    id: crypto.randomUUID(),
    category: "WORK",
    clockIn: isoToLocalInput(new Date().toISOString()),
    clockOut: "",
    babysitterBonus: false,
    note: "",
  };
}

export function Entries() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setEntries(await api.listEntries());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const totalHours = useMemo(() => sumPayableHours(entries), [entries]);

  function startEdit(e: TimeEntry) {
    setEditingId(e.id);
    setDraft(entryToDraft(e));
  }
  function startAdd() {
    setEditingId("new");
    setDraft(newDraft());
  }
  function cancel() {
    setEditingId(null);
    setDraft(null);
  }

  async function save() {
    if (!draft) return;
    if (!draft.clockIn) {
      setError("Clock in is required");
      return;
    }
    try {
      await api.saveEntry({
        id: draft.id,
        category: draft.category,
        clockIn: localInputToIso(draft.clockIn)!,
        clockOut: localInputToIso(draft.clockOut),
        babysitterBonus: draft.babysitterBonus,
        note: draft.note || null,
      });
      cancel();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry?")) return;
    await api.deleteEntry(id);
    await refresh();
  }

  return (
    <section>
      <div className="row between">
        <h2>Time entries</h2>
        <div className="totals">
          Total payable: <strong>{formatHours(totalHours)}</strong>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="row">
        <button onClick={startAdd} disabled={editingId === "new"}>
          + Add entry
        </button>
        <button className="link" onClick={refresh}>
          Refresh
        </button>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Category</th>
            <th>Clock in</th>
            <th>Clock out</th>
            <th>Bonus</th>
            <th>Hours</th>
            <th>Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {editingId === "new" && draft && (
            <EditRow
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onCancel={cancel}
            />
          )}
          {loading && (
            <tr>
              <td colSpan={7} className="muted">
                Loading…
              </td>
            </tr>
          )}
          {entries.map((e) =>
            editingId === e.id && draft ? (
              <EditRow
                key={e.id}
                draft={draft}
                setDraft={setDraft}
                onSave={save}
                onCancel={cancel}
              />
            ) : (
              <ViewRow
                key={e.id}
                entry={e}
                onEdit={() => startEdit(e)}
                onDelete={() => remove(e.id)}
              />
            ),
          )}
          {!loading && entries.length === 0 && editingId !== "new" && (
            <tr>
              <td colSpan={7} className="muted">
                No entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function ViewRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const h = computeEntryHours(entry);
  const hoursLabel =
    h.status === "COMPLETE"
      ? formatHours(h.payableHours)
      : h.status === "OPEN"
        ? "Clocked in…"
        : h.status === "INVALID"
          ? "⚠ Fix in/out"
          : "—";
  return (
    <tr>
      <td>{entry.category}</td>
      <td>{new Date(entry.clockIn).toLocaleString()}</td>
      <td>{entry.clockOut ? new Date(entry.clockOut).toLocaleString() : "—"}</td>
      <td>{entry.babysitterBonus ? "✓ +30m" : ""}</td>
      <td>{hoursLabel}</td>
      <td>{entry.note}</td>
      <td className="actions">
        <button className="link" onClick={onEdit}>
          Edit
        </button>
        <button className="link danger" onClick={onDelete}>
          Delete
        </button>
      </td>
    </tr>
  );
}

function EditRow({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="editing">
      <td>
        <select
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
        >
          <option value="WORK">WORK</option>
          <option value="BABYSITTER">BABYSITTER</option>
        </select>
      </td>
      <td>
        <input
          type="datetime-local"
          value={draft.clockIn}
          onChange={(e) => setDraft({ ...draft, clockIn: e.target.value })}
        />
      </td>
      <td>
        <input
          type="datetime-local"
          value={draft.clockOut}
          onChange={(e) => setDraft({ ...draft, clockOut: e.target.value })}
        />
      </td>
      <td>
        <input
          type="checkbox"
          checked={draft.babysitterBonus}
          onChange={(e) => setDraft({ ...draft, babysitterBonus: e.target.checked })}
        />
      </td>
      <td className="muted">—</td>
      <td>
        <input
          type="text"
          value={draft.note}
          placeholder="note"
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </td>
      <td className="actions">
        <button className="link" onClick={onSave}>
          Save
        </button>
        <button className="link" onClick={onCancel}>
          Cancel
        </button>
      </td>
    </tr>
  );
}
