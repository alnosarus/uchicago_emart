import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createTransactionSchema } from "@uchicago-marketplace/shared";
import { createTransaction, undoTransaction, getUserTransactions } from "../services/transaction.service";

const router = Router();

// GET /api/transactions/history — Current user's transaction history
router.get("/history", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getUserTransactions(req.userId!, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/", requireAuth, validate(createTransactionSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await createTransaction(req.userId!, req.body.postId, req.body.buyerId);
    res.status(201).json(transaction);
  } catch (err) { next(err); }
});

router.delete("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await undoTransaction(req.userId!, req.params.postId as string);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
