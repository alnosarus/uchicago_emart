import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createTransactionSchema } from "@uchicago-marketplace/shared";
import { createTransaction, undoTransaction } from "../services/transaction.service";

const router = Router();

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
