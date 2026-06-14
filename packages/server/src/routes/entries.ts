import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";
import { toTimeEntry } from "../mappers.js";

export const entriesRouter = Router();
entriesRouter.use(requireAuth);

const isPrivileged = (role: string) => role === "ADMIN" || role === "OWNER";

const upsertSchema = z.object({
  id: z.string().min(1),
  category: z.enum(["WORK", "BABYSITTER"]),
  clockIn: z.string().datetime(),
  clockOut: z.string().datetime().nullable(),
  babysitterBonus: z.boolean(),
  note: z.string().nullable(),
});

/** List entries. Workers see their own; admins/owners may pass ?userId=. */
entriesRouter.get("/", async (req, res) => {
  const { userId, role } = req.auth!;
  const target = isPrivileged(role) && typeof req.query.userId === "string"
    ? req.query.userId
    : userId;

  const rows = await prisma.timeEntry.findMany({
    where: { userId: target, deleted: false },
    orderBy: { clockIn: "desc" },
  });
  res.json(rows.map(toTimeEntry));
});

/** Create or replace an entry owned by the caller. */
entriesRouter.put("/:id", async (req, res) => {
  const { userId } = req.auth!;
  const parsed = upsertSchema.safeParse({ ...req.body, id: req.params.id });
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const d = parsed.data;

  // Ownership guard: don't let a write hijack another user's row id.
  const existing = await prisma.timeEntry.findUnique({ where: { id: d.id } });
  if (existing && existing.userId !== userId && !isPrivileged(req.auth!.role)) {
    return res.status(403).json({ error: "Not your entry" });
  }

  const row = await prisma.timeEntry.upsert({
    where: { id: d.id },
    create: {
      id: d.id,
      userId: existing?.userId ?? userId,
      category: d.category,
      clockIn: new Date(d.clockIn),
      clockOut: d.clockOut ? new Date(d.clockOut) : null,
      babysitterBonus: d.babysitterBonus,
      note: d.note,
      updatedAt: new Date(),
      deleted: false,
    },
    update: {
      category: d.category,
      clockIn: new Date(d.clockIn),
      clockOut: d.clockOut ? new Date(d.clockOut) : null,
      babysitterBonus: d.babysitterBonus,
      note: d.note,
      updatedAt: new Date(),
    },
  });
  res.json(toTimeEntry(row));
});

/** Soft-delete (tombstone) so the deletion still syncs to offline clients. */
entriesRouter.delete("/:id", async (req, res) => {
  const { userId, role } = req.auth!;
  const existing = await prisma.timeEntry.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.userId !== userId && !isPrivileged(role)) {
    return res.status(403).json({ error: "Not your entry" });
  }
  const row = await prisma.timeEntry.update({
    where: { id: req.params.id },
    data: { deleted: true, updatedAt: new Date() },
  });
  res.json(toTimeEntry(row));
});
