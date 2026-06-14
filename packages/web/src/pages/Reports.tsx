import { useEffect, useMemo, useState } from "react";
import {
  buildReport,
  formatHours,
  monthBounds,
  CATEGORIES,
  type Category,
  type CategoryRate,
  type ReportRange,
  type TimeEntry,
} from "@clock/shared";
import { api } from "../api.js";

type Mode = "month" | "range" | "all";

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function Reports({
  viewUserId,
  canEditRates,
}: {
  viewUserId: string;
  canEditRates: boolean;
}) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [rates, setRates] = useState<CategoryRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState(currentMonthValue());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const [e, r] = await Promise.all([api.listEntries(viewUserId), api.listRates(viewUserId)]);
      setEntries(e);
      setRates(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUserId]);

  const range = useMemo<ReportRange>(() => {
    if (mode === "month") return monthBounds(month);
    if (mode === "range") {
      return {
        from: from ? new Date(from + "T00:00:00") : undefined,
        to: to ? new Date(to + "T23:59:59.999") : undefined,
      };
    }
    return {};
  }, [mode, month, from, to]);

  const report = useMemo(() => buildReport(entries, rates, range), [entries, rates, range]);

  function rateValue(category: Category): number {
    return rates.find((r) => r.category === category)?.ratePerHour ?? 0;
  }

  async function saveRate(category: Category, value: number) {
    setRates((prev) => {
      const others = prev.filter((r) => r.category !== category);
      return [...others, { category, ratePerHour: value }];
    });
    try {
      await api.saveRate(category, value, viewUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2>Reports &amp; pay</h2>
      {error && <div className="error">{error}</div>}

      <div className="card" style={{ maxWidth: 520 }}>
        <strong>Hourly rates</strong>
        <p className="muted" style={{ margin: "0.25rem 0 0.75rem" }}>
          Used to compute pay below (sheet cells I8 / L8).
        </p>
        {CATEGORIES.map((category) => (
          <div className="row" key={category} style={{ margin: "0.4rem 0" }}>
            <span style={{ width: 130 }}>{category}</span>
            <span className="muted">$</span>
            <input
              // Re-mount when the loaded/saved rate changes so the uncontrolled
              // input reflects data that arrives after first render.
              key={`${category}-${rateValue(category)}`}
              type="number"
              min={0}
              step="0.5"
              defaultValue={rateValue(category)}
              disabled={!canEditRates}
              title={canEditRates ? undefined : "Only admins can change rates"}
              style={{ maxWidth: 120 }}
              onBlur={(e) => canEditRates && saveRate(category, Number(e.target.value))}
            />
            <span className="muted">/ hour</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label style={{ flexDirection: "row", alignItems: "center", gap: ".4rem" }}>
            <input type="radio" checked={mode === "month"} onChange={() => setMode("month")} /> Month
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: ".4rem" }}>
            <input type="radio" checked={mode === "range"} onChange={() => setMode("range")} /> Date range
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: ".4rem" }}>
            <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} /> All time
          </label>
        </div>

        {mode === "month" && (
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 200 }} />
        )}
        {mode === "range" && (
          <div className="row">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="muted">to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Category</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Pay</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((l) => (
                <tr key={l.category}>
                  <td>{l.category}</td>
                  <td>{formatHours(l.hours)}</td>
                  <td>{money(l.ratePerHour)}</td>
                  <td>{money(l.pay)}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td>{formatHours(report.totalHours)}</td>
                <td></td>
                <td>{money(report.totalPay)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
