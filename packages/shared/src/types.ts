/**
 * Core domain types, shared across server, web and desktop.
 *
 * Concepts carried over from the original Google Sheet + Apps Script:
 *  - A "time entry" == one row on the sheet (Date / Clock in / Clock out).
 *  - The "Babysitter" checkbox (column F) -> `babysitterBonus`, which added a
 *    flat 30 minutes to the hours (column E).
 *  - Per-category hourly rates ($33 Work, $8 Babysitter) -> CategoryRate.
 */

export type Role = "OWNER" | "ADMIN" | "WORKER";

/** Work categories. The sheet had two: "Work" and "Babysitter".
 *  Kept open-ended so more can be added without a schema change. */
export type Category = "WORK" | "BABYSITTER";

export const CATEGORIES: Category[] = ["WORK", "BABYSITTER"];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string; // ISO
}

/**
 * One clock in/out record. Times are stored as full ISO timestamps (UTC),
 * unlike the sheet which stored a separate date + time-of-day. This removes
 * the midnight-crossing ambiguity the sheet had.
 *
 * Sync fields:
 *  - `updatedAt` drives last-write-wins conflict resolution.
 *  - `deleted` is a tombstone so deletions propagate offline -> online.
 */
export interface TimeEntry {
  id: string; // uuid, client-generated so offline creates have stable ids
  userId: string;
  category: Category;
  clockIn: string; // ISO timestamp
  clockOut: string | null; // null while still clocked in
  /** Sheet column F: adds a flat 30 min when true (babysitter break/bonus). */
  babysitterBonus: boolean;
  note: string | null;
  updatedAt: string; // ISO; bumped on every local mutation
  deleted: boolean; // tombstone
}

/** A draft used when creating/editing; server fills server-side fields. */
export type TimeEntryInput = Pick<
  TimeEntry,
  "id" | "category" | "clockIn" | "clockOut" | "babysitterBonus" | "note"
>;

/** Hourly rate per category, per user (sheet cells I8 / L8). */
export interface CategoryRate {
  category: Category;
  ratePerHour: number;
}

// ---- Sync protocol ----------------------------------------------------------

export interface SyncPushRequest {
  entries: TimeEntry[];
}

export interface SyncPushResponse {
  /** Server's authoritative version of each pushed id after merge. */
  applied: TimeEntry[];
  serverTime: string; // ISO
}

export interface SyncPullResponse {
  entries: TimeEntry[]; // everything changed since `?since=`
  serverTime: string; // ISO; client stores this as the next `since`
}

// ---- Auth -------------------------------------------------------------------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}
