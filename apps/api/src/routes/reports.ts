import { Router } from "express";
import type { Response } from "express";
import { requireAuth, requireVerified, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createReportSchema } from "@uchicago-marketplace/shared";
import { createReport } from "../services/report.service";

const router = Router();

// POST /api/reports — User reports a post
router.post(
  "/",
  requireAuth,
  requireVerified,
  validate(createReportSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { postId, category, detail } = req.body;
      const report = await createReport(req.userId!, postId, category, detail);
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
