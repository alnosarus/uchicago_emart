import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { prisma } from "../config/database";

// Must be used AFTER requireAuth. Fetches isAdmin fresh from DB every
// request so that demotions take effect immediately (no JWT claim
// staleness).
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
