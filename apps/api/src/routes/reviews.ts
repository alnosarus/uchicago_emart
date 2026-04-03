import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createReviewSchema } from "@uchicago-marketplace/shared";
import { createReview, isEligibleToReview } from "../services/review.service";

const router = Router();

router.post("/", requireAuth, validate(createReviewSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const review = await createReview({ ...req.body, reviewerId: req.userId! });
    res.status(201).json(review);
  } catch (err) { next(err); }
});

router.get("/eligibility", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const postId = req.query.postId as string;
    if (!postId) { res.status(400).json({ message: "postId query parameter is required" }); return; }
    const result = await isEligibleToReview(req.userId!, postId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
