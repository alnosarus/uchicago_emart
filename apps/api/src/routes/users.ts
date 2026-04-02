import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { prisma } from "../config/database";
import { z } from "zod";
import { validate } from "../middleware/validate";

const router = Router();

// GET /api/users/:id — Public profile
router.get("/:id", async (req, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/me/profile — Current user's full profile
router.get("/me/profile", requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/me — Update profile
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

router.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const user = await prisma.user.update({
        where: { id: req.userId },
        data: req.body,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
        },
      });

      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
