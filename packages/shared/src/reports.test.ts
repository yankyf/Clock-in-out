import { describe, it, expect } from "vitest";
import { buildReport, monthBounds } from "./reports.js";
import type { CategoryRate, TimeEntry } from "./types.js";

const base = (over: Partial<TimeEntry>): TimeEntry => ({
  id: Math.random().toString(),
  userId: "u",
  category: "WORK",
  clockIn: "2026-06-11T11:00:00.000Z",
  clockOut: "2026-06-11T16:00:00.000Z",
  babysitterBonus: false,
  note: null,
  updatedAt: "2026-06-11T16:00:00.000Z",
  deleted: false,
  ...over,
});

const rates: CategoryRate[] = [
  { category: "WORK", ratePerHour: 33 },
  { category: "BABYSITTER", ratePerHour: 8 },
];

describe("buildReport", () => {
  const entries: TimeEntry[] = [
    base({ clockIn: "2026-06-11T11:00:00Z", clockOut: "2026-06-11T16:00:00Z" }), // WORK 5h
    base({ category: "BABYSITTER", clockIn: "2026-06-13T14:00:00Z", clockOut: "2026-06-13T16:00:00Z", babysitterBonus: true }), // 2h + 0.5
    base({ clockIn: "2026-07-01T09:00:00Z", clockOut: "2026-07-01T12:00:00Z" }), // WORK 3h in July
  ];

  it("totals pay per category across all time", () => {
    const r = buildReport(entries, rates);
    const work = r.lines.find((l) => l.category === "WORK")!;
    const sitter = r.lines.find((l) => l.category === "BABYSITTER")!;
    expect(work.hours).toBe(8); // 5 + 3
    expect(work.pay).toBe(8 * 33);
    expect(sitter.hours).toBe(2.5);
    expect(sitter.pay).toBe(2.5 * 8);
    expect(r.totalPay).toBe(8 * 33 + 2.5 * 8);
  });

  it("restricts to a month (no year-name collision)", () => {
    const r = buildReport(entries, rates, monthBounds("2026-06"));
    const work = r.lines.find((l) => l.category === "WORK")!;
    expect(work.hours).toBe(5); // July's 3h excluded
  });
});

describe("monthBounds", () => {
  it("spans the whole calendar month", () => {
    const { from, to } = monthBounds("2026-02"); // leap-ish boundary
    expect(from!.getDate()).toBe(1);
    expect(to!.getMonth()).toBe(1); // still February (index 1)
    expect(to!.getDate()).toBe(28);
  });
});
