import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { prisma } from "../config/database";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { getReviewsForUser } from "../services/review.service";
import { getUserTransactionCount } from "../services/transaction.service";

const router = Router();

// GET /api/users/search — Search users by name or cnetId
router.get("/search", requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.userId } },
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { cnetId: { startsWith: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        cnetId: true,
        avatarUrl: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /api/users/me/profile — Current user's full profile
router.get("/me/profile", requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.userId!;

    const [user, reviewData, transactionCount, activeListingCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          cnetId: true,
          phone: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
        },
      }),
      getReviewsForUser(userId, 1, 10),
      getUserTransactionCount(userId),
      prisma.post.count({
        where: { authorId: userId, status: "active" },
      }),
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const activePosts = await prisma.post.findMany({
      where: { authorId: userId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        marketplace: true,
        storage: true,
        housing: true,
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    });

    res.json({
      ...user,
      stats: {
        averageRating: reviewData.averageRating,
        reviewCount: reviewData.total,
        transactionCount,
        activeListingCount,
      },
      activePosts,
      reviews: {
        data: reviewData.data,
        total: reviewData.total,
      },
    });
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

// GET /api/users/:id/reviews — Reviews received by a user
router.get("/:id/reviews", async (req, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await getReviewsForUser(req.params.id as string, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/users/:id — Enriched public profile
router.get("/:id", async (req, res: Response, next) => {
  try {
    const userId = req.params.id as string;

    const [user, reviewData, transactionCount, activeListingCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          cnetId: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
        },
      }),
      getReviewsForUser(userId, 1, 10),
      getUserTransactionCount(userId),
      prisma.post.count({
        where: { authorId: userId, status: "active" },
      }),
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const activePosts = await prisma.post.findMany({
      where: { authorId: userId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        marketplace: true,
        storage: true,
        housing: true,
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    });

    res.json({
      ...user,
      stats: {
        averageRating: reviewData.averageRating,
        reviewCount: reviewData.total,
        transactionCount,
        activeListingCount,
      },
      activePosts,
      reviews: {
        data: reviewData.data,
        total: reviewData.total,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
