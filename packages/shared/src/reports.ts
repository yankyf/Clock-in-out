/**
 * Reporting — the TypeScript equivalent of the sheet's H–L payroll panels
 * (monthly totals, date-range totals, and "Total $$" = hours × rate).
 */

import type { Category, CategoryRate, TimeEntry } from "./types.js";
import { CATEGORIES } from "./types.js";
import { entriesInRange, sumPayableHours } from "./hours.js";

export interface CategoryReportLine {
  category: Category;
  hours: number; // payable hours (incl. babysitter bonus)
  ratePerHour: number;
  pay: number; // hours × rate
}

export interface Report {
  from: string | null; // ISO; null = all time
  to: string | null;
  lines: CategoryReportLine[];
  totalHours: number;
  totalPay: number;
}

export interface ReportRange {
  /** Inclusive lower bound on clockIn. Omit for "all time". */
  from?: Date;
  /** Inclusive upper bound on clockIn. Omit for "all time". */
  to?: Date;
}

function rateFor(rates: CategoryRate[], category: Category): number {
  return rates.find((r) => r.category === category)?.ratePerHour ?? 0;
}

/**
 * Build a per-category hours + pay report over an optional date range.
 * Mirrors the sheet: each category's payable hours × its $/hour.
 */
export function buildReport(
  entries: TimeEntry[],
  rates: CategoryRate[],
  range: ReportRange = {},
): Report {
  const scoped =
    range.from || range.to
      ? entriesInRange(
          entries,
          range.from ?? new Date(0),
          range.to ?? new Date(8640000000000000), // max date
        )
      : entries.filter((e) => !e.deleted);

  const lines: CategoryReportLine[] = CATEGORIES.map((category) => {
    const hours = sumPayableHours(scoped.filter((e) => e.category === category));
    const ratePerHour = rateFor(rates, category);
    return { category, hours, ratePerHour, pay: hours * ratePerHour };
  });

  return {
    from: range.from ? range.from.toISOString() : null,
    to: range.to ? range.to.toISOString() : null,
    lines,
    totalHours: lines.reduce((s, l) => s + l.hours, 0),
    totalPay: lines.reduce((s, l) => s + l.pay, 0),
  };
}

/**
 * Inclusive [start, end] bounds for a calendar month, in local time.
 * `month` is a "YYYY-MM" string (matches an <input type="month">).
 * Replaces the sheet's fragile TEXT(A:A,"mmmm") month-name match, which
 * collided across years.
 */
export function monthBounds(month: string): ReportRange {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const to = new Date(y, m, 0, 23, 59, 59, 999); // day 0 of next month = last day
  return { from, to };
}
