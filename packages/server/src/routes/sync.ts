import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";
import { toTimeEntry } from "../mappers.js";
import type { SyncPullResponse, SyncPushResponse } from "@clock/shared";

/**
 * Sync engine (server side). Last-write-wins on `updatedAt`.
 *
 *  POST /sync/push  { entries: TimeEntry[] }  -> merges each entry; a push only
 *    overwrites the server row if the incoming updatedAt is newer.
 *  GET  /sync/pull?since=ISO                  -> every entry for the caller
 *    changed strictly after `since` (including tombstones).
 */
export const syncRouter = Router();
syncRouter.use(requireAuth);

const entrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  category: z.enum(["WORK", "BABYSITTER"]),
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().nullable(),
  babysitterBonus: z.boolean(),
  note: z.string().nullable(),
  updatedAt: z.string().datetime(),
  deleted: z.boolean(),
});

const pushSchema = z.object({ entries: z.array(entrySchema) });

syncRouter.post("/push", async (req, res) => {
  const { userId, role } = req.auth!;
  const parsed = pushSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const privileged = role === "ADMIN" || role === "OWNER";

  const applied = [];
  for (const incoming of parsed.data.entries) {
    // A client may only push its own rows (unless privileged).
    if (incoming.userId !== userId && !privileged) continue;

    const existing = await prisma.timeEntry.findUnique({ where: { id: incoming.id } });

    // Last-write-wins: skip if server copy is newer or equal.
    if (existing && existing.updatedAt.getTime() >= new Date(incoming.updatedAt).getTime()) {
      applied.push(toTimeEntry(existing));
      continue;
    }

    const data = {
      userId: incoming.userId,
      category: incoming.category,
      clockIn: new Date(incoming.clockIn),
      clockOut: incoming.clockOut ? new Date(incoming.clockOut) : null,
      babysitterBonus: incoming.babysitterBonus,
      note: incoming.note,
      updatedAt: new Date(incoming.updatedAt),
      deleted: incoming.deleted,
    };

    const row = await prisma.timeEntry.upsert({
      where: { id: incoming.id },
      create: { id: incoming.id, ...data },
      update: data,
    });
    applied.push(toTimeEntry(row));
  }

  const payload: SyncPushResponse = {
    applied,
    serverTime: new Date().toISOString(),
  };
  res.json(payload);
});

syncRouter.get("/pull", async (req, res) => {
  const { userId, role } = req.auth!;
  const since = typeof req.query.since === "string" ? new Date(req.query.since) : new Date(0);
  const privileged = role === "ADMIN" || role === "OWNER";

  const rows = await prisma.timeEntry.findMany({
    where: {
      updatedAt: { gt: since },
      ...(privileged ? {} : { userId }),
    },
    orderBy: { updatedAt: "asc" },
  });

  const payload: SyncPullResponse = {
    entries: rows.map(toTimeEntry),
    serverTime: new Date().toISOString(),
  };
  res.json(payload);
});
