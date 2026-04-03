import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { savePost, unsavePost, getSavedPosts } from "../services/saved.service";

const router = Router();

router.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getSavedPosts(req.userId!, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

router.post("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await savePost(req.userId!, req.params.postId as string);
    res.json({ saved: true });
  } catch (err) { next(err); }
});

router.delete("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await unsavePost(req.userId!, req.params.postId as string);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
