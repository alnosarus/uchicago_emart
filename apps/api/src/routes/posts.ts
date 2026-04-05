import { Router } from "express";
import type { Response, NextFunction } from "express";
import multer from "multer";
import { requireAuth, optionalAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createPostSchema, postQuerySchema } from "@uchicago-marketplace/shared";
import {
  createPost,
  listPosts,
  getPostById,
  updatePost,
  deletePost,
  addPostImages,
  deletePostImage,
  reorderPostImages,
} from "../services/posts.service";
import { uploadImage } from "../services/upload.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function param(req: AuthRequest, name: string): string {
  return req.params[name] as string;
}

// POST /api/posts — Create a new post
router.post("/", requireAuth, validate(createPostSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await createPost({ ...req.body, authorId: req.userId! });
    res.status(201).json(post);
  } catch (err) { next(err); }
});

// GET /api/posts — List posts with filters
router.get("/", optionalAuth, validate(postQuerySchema, "query"), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await listPosts({ ...req.query as any, userId: req.userId });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /api/posts/:id — Get post detail
router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await getPostById(param(req, "id"), req.userId);
    res.json(post);
  } catch (err) { next(err); }
});

// PATCH /api/posts/:id — Update a post (owner only)
router.patch("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await updatePost(param(req, "id"), req.userId!, req.body);
    res.json(post);
  } catch (err) { next(err); }
});

// DELETE /api/posts/:id — Soft delete a post (owner only)
router.delete("/:id", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deletePost(param(req, "id"), req.userId!);
    res.status(204).end();
  } catch (err) { next(err); }
});

// PATCH /api/posts/:id/renew — Renew a post
router.patch("/:id/renew", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { renewPost } = await import("../services/notification.service");
    const post = await renewPost(param(req, "id"), req.userId!);
    res.json(post);
  } catch (err) { next(err); }
});

// POST /api/posts/:id/images — Upload images to a post
router.post("/:id/images", requireAuth, upload.array("images", 8), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ message: "No files provided" });
      return;
    }

    const postId = param(req, "id");
    const uploads = await Promise.all(
      files.map((f) => uploadImage(f.buffer, f.mimetype, f.originalname, postId))
    );

    const images = await addPostImages(postId, req.userId!, uploads);
    res.status(201).json({ images });
  } catch (err) { next(err); }
});

// PATCH /api/posts/:id/images/reorder — Reorder images
router.patch("/:id/images/reorder", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { imageIds } = req.body as { imageIds: string[] };
    if (!imageIds || !Array.isArray(imageIds)) {
      res.status(400).json({ message: "imageIds array required" });
      return;
    }
    await reorderPostImages(param(req, "id"), req.userId!, imageIds);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/posts/images/:imageId — Delete an image
router.delete("/images/:imageId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deletePostImage(param(req, "imageId"), req.userId!);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
