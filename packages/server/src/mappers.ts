import type { CategoryRate, TimeEntry } from "@clock/shared";
import type { Rate as DbRate, TimeEntry as DbTimeEntry } from "@prisma/client";

/** Prisma row (Date objects) -> shared TimeEntry (ISO strings). */
export function toTimeEntry(row: DbTimeEntry): TimeEntry {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as TimeEntry["category"],
    clockIn: row.clockIn.toISOString(),
    clockOut: row.clockOut ? row.clockOut.toISOString() : null,
    babysitterBonus: row.babysitterBonus,
    note: row.note,
    updatedAt: row.updatedAt.toISOString(),
    deleted: row.deleted,
  };
}

export function toCategoryRate(row: DbRate): CategoryRate {
  return {
    category: row.category as CategoryRate["category"],
    ratePerHour: row.ratePerHour,
  };
}
