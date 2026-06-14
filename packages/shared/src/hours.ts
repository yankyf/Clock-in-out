/**
 * Hours & pay calculations — the TypeScript translation of the sheet formulas.
 *
 * Sheet column D (Total Hours):
 *   =if(C="", if(B="","","Clock out"),
 *      if(C-B<0, "Correct Clock in / out", C-B))
 *
 * Sheet column E (Total Babysiter):
 *   = if babysitter checkbox -> D + 30 min, else D
 *
 * Here we return structured results instead of magic strings, so the UI can
 * decide how to render each state.
 */

import type { TimeEntry, Category, CategoryRate } from "./types.js";

export type EntryStatus =
  | "EMPTY" // no clock in (sheet: "")
  | "OPEN" // clocked in, not out yet (sheet: "Clock out")
  | "INVALID" // clock out before clock in (sheet: "Correct Clock in / out")
  | "COMPLETE";

export interface EntryHours {
  status: EntryStatus;
  /** Worked duration in hours (clockOut - clockIn). 0 unless COMPLETE. */
  baseHours: number;
  /** baseHours plus the flat 30-min babysitter bonus when applicable. */
  payableHours: number;
}

const MS_PER_HOUR = 1000 * 60 * 60;
const BABYSITTER_BONUS_HOURS = 0.5; // sheet's flat TIME(0,30,0)

/** Mirrors sheet columns D and E for a single entry. */
export function computeEntryHours(entry: {
  clockIn: string | null;
  clockOut: string | null;
  babysitterBonus: boolean;
}): EntryHours {
  if (!entry.clockIn) {
    return { status: "EMPTY", baseHours: 0, payableHours: 0 };
  }
  if (!entry.clockOut) {
    return { status: "OPEN", baseHours: 0, payableHours: 0 };
  }

  const inMs = new Date(entry.clockIn).getTime();
  const outMs = new Date(entry.clockOut).getTime();
  const diffMs = outMs - inMs;

  if (diffMs < 0) {
    return { status: "INVALID", baseHours: 0, payableHours: 0 };
  }

  const baseHours = diffMs / MS_PER_HOUR;
  const payableHours = entry.babysitterBonus
    ? baseHours + BABYSITTER_BONUS_HOURS
    : baseHours;

  return { status: "COMPLETE", baseHours, payableHours };
}

/** Sum of payable hours for a set of entries (only COMPLETE ones count). */
export function sumPayableHours(entries: TimeEntry[]): number {
  return entries.reduce((total, e) => {
    if (e.deleted) return total;
    const { status, payableHours } = computeEntryHours(e);
    return status === "COMPLETE" ? total + payableHours : total;
  }, 0);
}

/** Total $ for a category over a set of entries (sheet: hours * rate). */
export function computePay(
  entries: TimeEntry[],
  category: Category,
  rates: CategoryRate[],
): number {
  const rate = rates.find((r) => r.category === category)?.ratePerHour ?? 0;
  const inCategory = entries.filter((e) => e.category === category);
  return sumPayableHours(inCategory) * rate;
}

/** Filter helper: entries whose clockIn falls within [start, end] inclusive. */
export function entriesInRange(
  entries: TimeEntry[],
  start: Date,
  end: Date,
): TimeEntry[] {
  const s = start.getTime();
  const e = end.getTime();
  return entries.filter((entry) => {
    if (entry.deleted || !entry.clockIn) return false;
    const t = new Date(entry.clockIn).getTime();
    return t >= s && t <= e;
  });
}

/** Format a decimal-hours value as "Hh Mm" (e.g. 5.5 -> "5h 30m"). */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}
