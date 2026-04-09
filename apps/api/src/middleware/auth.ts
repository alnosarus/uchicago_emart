import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/auth";
import { prisma } from "../config/database";

export interface AuthRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);
  let userId: string;
  try {
    const payload = jwt.verify(token, JWT_CONFIG.accessSecret) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // Check ban status on every authenticated request.
  // One cheap indexed PK lookup; ensures bans take effect immediately
  // without waiting for JWT expiry.
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });
    if (!user) {
      res.status(401).json({ message: "Account not found" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ message: "Account banned", code: "ACCOUNT_BANNED" });
      return;
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  // Must be used AFTER requireAuth
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // Skip phone verification in local development
  if (process.env.NODE_ENV === "development") {
    next();
    return;
  }

  prisma.user
    .findUnique({ where: { id: req.userId }, select: { isVerified: true } })
    .then((user) => {
      if (!user || !user.isVerified) {
        res.status(403).json({ message: "Phone verification required", code: "VERIFICATION_REQUIRED" });
        return;
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ message: "Internal server error" });
    });
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
