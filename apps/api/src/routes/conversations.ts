import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, requireVerified, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createConversationSchema,
  sendMessageSchema,
  messagesPaginationSchema,
} from "@uchicago-marketplace/shared";
import {
  getConversationsWithUnread,
  createConversation,
  getConversation,
  getMessages,
  sendMessage,
  markRead,
  getTotalUnreadCount,
} from "../services/conversation.service";
import { getIO } from "../socket";

const router = Router();

// GET /api/conversations
router.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await getConversationsWithUnread(req.userId!);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/conversations/unread-count
router.get("/unread-count", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const count = await getTotalUnreadCount(req.userId!);
    res.json({ count });
  } catch (err) { next(err); }
});

// POST /api/conversations
router.post("/", requireAuth, requireVerified, validate(createConversationSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { postId } = req.body;
    const { conversation, created } = await createConversation(req.userId!, postId);

    if (created) {
      // Notify the post author via socket
      const details = await getConversation(conversation.id, conversation.participant2Id);
      const io = getIO();
      if (io) {
        io.to(`user:${conversation.participant2Id}`).emit("conversation_created", {
          conversation: details,
        });
      }
    }

    res.status(created ? 201 : 200).json(conversation);
  } catch (err) { next(err); }
});

// GET /api/conversations/:id
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversation = await getConversation(req.params.id as string, req.userId!);
    res.json(conversation);
  } catch (err) { next(err); }
});

// GET /api/conversations/:id/messages
router.get("/:id/messages", requireAuth, validate(messagesPaginationSchema, "query"), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { before, limit } = req.query as unknown as { before?: string; limit: number };
    const result = await getMessages(req.params.id as string, req.userId!, { before, limit });
    res.json(result);
  } catch (err) { next(err); }
});

// POST /api/conversations/:id/messages
router.post("/:id/messages", requireAuth, requireVerified, validate(sendMessageSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { body } = req.body;
    const { message, recipientId } = await sendMessage(req.params.id as string, req.userId!, body);

    // Push to recipient via socket
    const io = getIO();
    if (io) {
      io.to(`user:${recipientId}`).emit("new_message", {
        message,
        conversationId: req.params.id as string,
      });
    }

    res.status(201).json(message);
  } catch (err) { next(err); }
});

// PATCH /api/conversations/:id/read
router.patch("/:id/read", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { readAt, otherUserId } = await markRead(req.params.id as string, req.userId!);

    // Notify the other participant their messages were read
    const io = getIO();
    if (io) {
      io.to(`user:${otherUserId}`).emit("messages_read", {
        conversationId: req.params.id as string,
        readAt: readAt.toISOString(),
        readBy: req.userId!,
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
