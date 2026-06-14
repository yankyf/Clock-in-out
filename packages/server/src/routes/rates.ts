import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";
import { toCategoryRate } from "../mappers.js";

/**
 * Per-user hourly rates (sheet cells I8 / L8). Each user keeps one rate per
 * category. Admins/owners may read/write another user's rates via ?userId=.
 */
export const ratesRouter = Router();
ratesRouter.use(requireAuth);

const isPrivileged = (role: string) => role === "ADMIN" || role === "OWNER";

function targetUser(req: { auth?: { userId: string; role: string }; query: Record<string, unknown> }) {
  const { userId, role } = req.auth!;
  return isPrivileged(role) && typeof req.query.userId === "string"
    ? req.query.userId
    : userId;
}

ratesRouter.get("/", async (req, res) => {
  const rows = await prisma.rate.findMany({ where: { userId: targetUser(req) } });
  res.json(rows.map(toCategoryRate));
});

const putSchema = z.object({ ratePerHour: z.number().nonnegative() });

ratesRouter.put("/:category", async (req, res) => {
  const category = req.params.category.toUpperCase();
  if (category !== "WORK" && category !== "BABYSITTER") {
    return res.status(400).json({ error: "Unknown category" });
  }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "ratePerHour must be a non-negative number" });

  const userId = targetUser(req);
  const row = await prisma.rate.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, ratePerHour: parsed.data.ratePerHour },
    update: { ratePerHour: parsed.data.ratePerHour },
  });
  res.json(toCategoryRate(row));
});
