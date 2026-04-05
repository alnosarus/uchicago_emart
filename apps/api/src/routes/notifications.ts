import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../services/notification.service";

const router = Router();

// GET /api/notifications — List user's notifications
router.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getUserNotifications(req.userId!, page, limit);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/notifications/unread-count — Get unread count
router.get("/unread-count", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await getUnreadCount(req.userId!);
    res.json({ count });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read — Mark one as read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notification = await markAsRead(req.params.id as string, req.userId!);
    res.json(notification);
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all — Mark all as read
router.patch("/read-all", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await markAllAsRead(req.userId!);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
