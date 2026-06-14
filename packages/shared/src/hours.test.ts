import { describe, it, expect } from "vitest";
import { computeEntryHours, sumPayableHours, computePay } from "./hours.js";
import type { TimeEntry, CategoryRate } from "./types.js";

const base = (over: Partial<TimeEntry>): TimeEntry => ({
  id: "x",
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

describe("computeEntryHours", () => {
  it("returns EMPTY when no clock in", () => {
    expect(computeEntryHours({ clockIn: null, clockOut: null, babysitterBonus: false }).status).toBe("EMPTY");
  });

  it("returns OPEN when clocked in but not out", () => {
    const r = computeEntryHours({ clockIn: "2026-06-11T11:00:00Z", clockOut: null, babysitterBonus: false });
    expect(r.status).toBe("OPEN");
  });

  it("returns INVALID when out is before in", () => {
    const r = computeEntryHours({ clockIn: "2026-06-11T16:00:00Z", clockOut: "2026-06-11T11:00:00Z", babysitterBonus: false });
    expect(r.status).toBe("INVALID");
  });

  it("computes a 5-hour shift", () => {
    const r = computeEntryHours({ clockIn: "2026-06-11T11:00:00Z", clockOut: "2026-06-11T16:00:00Z", babysitterBonus: false });
    expect(r.status).toBe("COMPLETE");
    expect(r.baseHours).toBe(5);
    expect(r.payableHours).toBe(5);
  });

  it("adds the flat 30-min babysitter bonus", () => {
    const r = computeEntryHours({ clockIn: "2026-06-11T11:00:00Z", clockOut: "2026-06-11T16:00:00Z", babysitterBonus: true });
    expect(r.payableHours).toBe(5.5);
  });
});

describe("sumPayableHours / computePay", () => {
  const entries: TimeEntry[] = [
    base({ id: "a", clockIn: "2026-06-11T11:00:00Z", clockOut: "2026-06-11T16:00:00Z" }), // 5h
    base({ id: "b", clockIn: "2026-06-12T10:00:00Z", clockOut: "2026-06-12T13:00:00Z", babysitterBonus: true }), // 3.5h
    base({ id: "c", clockOut: null }), // OPEN, ignored
    base({ id: "d", deleted: true }), // tombstone, ignored
  ];

  it("sums only complete, non-deleted entries", () => {
    expect(sumPayableHours(entries)).toBe(8.5);
  });

  it("computes pay at the category rate", () => {
    const rates: CategoryRate[] = [{ category: "WORK", ratePerHour: 33 }];
    expect(computePay(entries, "WORK", rates)).toBeCloseTo(8.5 * 33);
  });
});
