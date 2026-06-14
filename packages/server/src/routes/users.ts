import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireAdmin } from "../auth.js";
import { toUser } from "../mappers.js";

/**
 * Team management — admin/owner only. Workers clock in/out; admins create
 * accounts, assign roles, reset passwords, and review everyone's data.
 */
export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

usersRouter.get("/", async (_req, res) => {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json(rows.map(toUser));
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "WORKER"]).default("WORKER"),
  password: z.string().min(6),
});

usersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, name, role, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const user = await prisma.user.create({
    data: { email: email.toLowerCase(), name, role, passwordHash: await bcrypt.hash(password, 10) },
  });

  // Seed default rates so new users' reports work out of the box.
  for (const [category, ratePerHour] of [["WORK", 33], ["BABYSITTER", 8]] as const) {
    await prisma.rate.create({ data: { userId: user.id, category, ratePerHour } });
  }

  res.status(201).json(toUser(user));
});

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.enum(["OWNER", "ADMIN", "WORKER"]).optional(),
    password: z.string().min(6).optional(),
  })
  .refine((v) => v.name || v.role || v.password, { message: "Nothing to update" });

usersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "User not found" });

  // Guard: don't let the last OWNER be demoted (would lock everyone out).
  if (target.role === "OWNER" && parsed.data.role && parsed.data.role !== "OWNER") {
    const owners = await prisma.user.count({ where: { role: "OWNER" } });
    if (owners <= 1) return res.status(400).json({ error: "Cannot demote the only owner" });
  }

  const data: { name?: string; role?: string; passwordHash?: string } = {};
  if (parsed.data.name) data.name = parsed.data.name;
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const updated = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(toUser(updated));
});
