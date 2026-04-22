import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createTransactionSchema, buyerInitiateTransactionSchema } from "@uchicago-marketplace/shared";
import {
  createTransaction,
  buyerInitiateTransaction,
  confirmTransaction,
  undoTransaction,
  getUserTransactions,
  getTransactionByPostId,
} from "../services/transaction.service";

const router = Router();

// GET /api/transactions/history
router.get("/history", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const withUserId = req.query.with as string | undefined;
    const result = await getUserTransactions(req.userId!, page, limit, withUserId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/transactions — seller marks as sold
router.post("/", requireAuth, validate(createTransactionSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await createTransaction(req.userId!, req.body.postId, req.body.buyerId);
    res.status(201).json(transaction);
  } catch (err) { next(err); }
});

// POST /api/transactions/buyer — buyer marks as bought
router.post("/buyer", requireAuth, validate(buyerInitiateTransactionSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await buyerInitiateTransaction(req.userId!, req.body.postId);
    res.status(201).json(transaction);
  } catch (err) { next(err); }
});

// PATCH /api/transactions/:postId/confirm — confirm the transaction
router.patch("/:postId/confirm", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await confirmTransaction(req.userId!, req.params.postId as string);
    res.json(transaction);
  } catch (err) { next(err); }
});

// GET /api/transactions/:postId — get transaction for a post (only seller or buyer)
router.get("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await getTransactionByPostId(req.params.postId as string);
    if (!transaction) { res.status(404).json({ message: "No transaction found" }); return; }
    if (transaction.sellerId !== req.userId && transaction.buyerId !== req.userId) {
      res.status(403).json({ message: "Forbidden" }); return;
    }
    res.json(transaction);
  } catch (err) { next(err); }
});

// DELETE /api/transactions/:postId — undo (seller only, within 24h, pending only)
router.delete("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await undoTransaction(req.userId!, req.params.postId as string);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
