import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, signToken } from "../auth.js";
import type { LoginResponse, Role, User } from "@clock/shared";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "email and password required" });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ userId: user.id, role: user.role as Role });
  const payload: LoginResponse = {
    token,
    user: publicUser(user),
  };
  res.json(payload);
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

function publicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}): User {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    createdAt: u.createdAt.toISOString(),
  };
}
