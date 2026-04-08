import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  listReportsQuerySchema,
  resolveReportSchema,
} from "@uchicago-marketplace/shared";
import { listReports, resolveReport } from "../services/report.service";

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/reports
router.get(
  "/reports",
  validate(listReportsQuerySchema, "query"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const result = await listReports(req.query as never);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/admin/reports/:id
router.patch(
  "/reports/:id",
  validate(resolveReportSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const reportId = req.params.id as string;
      const report = await resolveReport(reportId, req.userId!, req.body);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
