import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./env.js";
import type { Role } from "@clock/shared";

export interface AuthClaims {
  userId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: "30d" });
}

/** Express middleware: requires a valid Bearer token, attaches req.auth. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  try {
    const claims = jwt.verify(header.slice(7), JWT_SECRET) as AuthClaims;
    req.auth = { userId: claims.userId, role: claims.role };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function isPrivileged(role: Role): boolean {
  return role === "ADMIN" || role === "OWNER";
}

/** Middleware: requires the caller to be an ADMIN or OWNER. Use after requireAuth. */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !isPrivileged(req.auth.role)) {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}
