import type { CategoryRate, Role, TimeEntry, User } from "@clock/shared";
import type { Rate as DbRate, TimeEntry as DbTimeEntry, User as DbUser } from "@prisma/client";

export function toUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as Role,
    createdAt: row.createdAt.toISOString(),
  };
}

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
