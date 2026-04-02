import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/auth";
import { prisma } from "../config/database";

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_CONFIG.accessSecret) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_CONFIG.accessSecret) as { userId: string };
    req.userId = payload.userId;
  } catch {
    // Invalid token — proceed without auth
  }
  next();
}
