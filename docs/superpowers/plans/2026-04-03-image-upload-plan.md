# Image Upload System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive image upload with server-side processing (resize, WebP, thumbnail, blur hash, EXIF strip) across web, mobile, and API — including drag-and-drop reordering, edit-flow image management, and optimized display.

**Architecture:** Two-phase upload: clients compress images locally then upload on submit. API stores originals in Firebase Storage and enqueues BullMQ jobs for async processing (full-size WebP, thumbnail, blur hash). Redis powers the job queue. Both web and mobile get drag-and-drop reordering with full create/edit parity.

**Tech Stack:** Express + Multer + sharp + BullMQ + Redis (API), Next.js + @dnd-kit + browser-image-compression + react-blurhash (web), Expo + expo-image-manipulator + react-native-draggable-flatlist (mobile), Prisma + PostgreSQL (DB), Firebase Storage (files)

**Spec:** `docs/superpowers/specs/2026-04-03-image-upload-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/api/src/worker.ts` | BullMQ worker entrypoint — processes image jobs |
| `apps/api/src/queues/image-processing.queue.ts` | Queue definition + job enqueue helper |
| `apps/api/src/workers/image-processing.worker.ts` | Job handler: resize, WebP, thumbnail, blur hash |
| `apps/api/src/config/redis.ts` | Redis/IORedis connection singleton |
| `apps/web/src/components/ImageUploadGrid.tsx` | Drag-and-drop image upload grid (web) |
| `apps/web/src/app/posts/[id]/edit/page.tsx` | Web edit page with image management |

### Modified files

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add `ImageStatus` enum, add `fullUrl`, `thumbUrl`, `blurHash`, `status` to `PostImage` |
| `apps/api/src/services/upload.service.ts` | Organized storage paths, EXIF strip with sharp |
| `apps/api/src/services/posts.service.ts` | Update `addPostImages` to enqueue jobs, add `reorderPostImages` |
| `apps/api/src/routes/posts.ts` | Return image records from upload, add reorder endpoint |
| `apps/api/package.json` | Add bullmq, ioredis, sharp, blurhash deps |
| `packages/shared/src/types/post.ts` | Add `fullUrl`, `thumbUrl`, `blurHash`, `status` to `PostImage` |
| `packages/shared/src/api-client/posts.ts` | Add `deleteImage`, `reorderImages` methods |
| `apps/web/package.json` | Add browser-image-compression, @dnd-kit/core, @dnd-kit/sortable, react-blurhash |
| `apps/web/src/app/create/page.tsx` | Add ImageUploadGrid to Step 3, upload on submit |
| `apps/web/src/app/browse/page.tsx` | Use `thumbUrl` in PostCard, add blur hash placeholder |
| `apps/web/src/app/posts/[id]/page.tsx` | Update ImageGallery for `fullUrl`, blur hash |
| `apps/mobile/package.json` | Add react-native-draggable-flatlist, expo-image-manipulator |
| `apps/mobile/components/ImagePickerGrid.tsx` | Add compression, drag-and-drop reorder, cover badge |
| `apps/mobile/hooks/useCreatePost.ts` | Add per-image status tracking and retry |
| `docker-compose.yml` | Add Redis service |
| `dev.sh` | Add worker process |

---

## Task 1: Prisma Schema — Add Image Processing Fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma:83-101`

- [ ] **Step 1: Add ImageStatus enum and update PostImage model**

In `apps/api/prisma/schema.prisma`, add the `ImageStatus` enum after the `PostStatus` enum (after line 61), and update the `PostImage` model:

```prisma
enum ImageStatus {
  processing
  ready
  failed
}
```

Replace the `PostImage` model (lines 91-101) with:

```prisma
model PostImage {
  id        String      @id @default(uuid())
  postId    String      @map("post_id")
  url       String
  fullUrl   String?     @map("full_url")
  thumbUrl  String?     @map("thumb_url")
  blurHash  String?     @map("blur_hash")
  status    ImageStatus @default(processing)
  order     Int         @default(0)
  createdAt DateTime    @default(now()) @map("created_at")

  post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
  @@map("post_images")
}
```

- [ ] **Step 2: Generate and run the migration**

Run from `apps/api`:
```bash
npx prisma migrate dev --name add-image-processing-fields
```

Expected: Migration creates successfully, adds `full_url`, `thumb_url`, `blur_hash`, `status` columns and `ImageStatus` enum.

- [ ] **Step 3: Verify Prisma client generated correctly**

Run:
```bash
npx prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add image processing fields to PostImage schema"
```

---

## Task 2: Install API Dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install bullmq, ioredis, sharp, and blurhash**

Run from `apps/api`:
```bash
pnpm add bullmq ioredis sharp blurhash
pnpm add -D @types/sharp
```

- [ ] **Step 2: Verify installation**

Run:
```bash
node -e "require('bullmq'); require('ioredis'); require('sharp'); require('blurhash'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "feat: add bullmq, ioredis, sharp, blurhash to API"
```

---

## Task 3: Redis Configuration + Docker + dev.sh

**Files:**
- Create: `apps/api/src/config/redis.ts`
- Modify: `docker-compose.yml`
- Modify: `dev.sh`
- Modify: `apps/api/src/config/env.ts`

- [ ] **Step 1: Add REDIS_URL to env schema**

In `apps/api/src/config/env.ts`, add to the `envSchema` object:

```typescript
REDIS_URL: z.string().default("redis://localhost:6379"),
```

- [ ] **Step 2: Create Redis connection singleton**

Create `apps/api/src/config/redis.ts`:

```typescript
import IORedis from "ioredis";
import { env } from "./env";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}
```

- [ ] **Step 3: Add Redis to docker-compose.yml**

Add the Redis service after the `db` service block (after line 18) and before the `api` service:

```yaml
  # ── Local Redis ──
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

- [ ] **Step 4: Update dev.sh to run worker alongside API and Web**

Replace the full content of `dev.sh` with:

```bash
#!/bin/bash
# Start API (port 3000), Web (port 3001), and Worker for local development
# Usage: ./dev.sh

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $API_PID $WEB_PID $WORKER_PID 2>/dev/null
  wait $API_PID $WEB_PID $WORKER_PID 2>/dev/null
  echo "Done."
}
trap cleanup EXIT INT TERM

# Kill anything already on ports 3000/3001
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo "=== Starting API on http://localhost:3000 ==="
cd "$ROOT_DIR/apps/api"
npx tsx watch src/index.ts &
API_PID=$!

echo "=== Starting Worker ==="
cd "$ROOT_DIR/apps/api"
npx tsx watch src/worker.ts &
WORKER_PID=$!

echo "=== Starting Web on http://localhost:3001 ==="
cd "$ROOT_DIR/apps/web"
npx next dev -p 3001 &
WEB_PID=$!

echo ""
echo "API:    http://localhost:3000"
echo "Web:    http://localhost:3001"
echo "Worker: running"
echo ""
echo "Press Ctrl+C to stop all."

wait
```

- [ ] **Step 5: Add worker script to API package.json**

In `apps/api/package.json`, add to `"scripts"`:

```json
"worker": "tsx src/worker.ts",
"worker:dev": "tsx watch src/worker.ts"
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config/redis.ts apps/api/src/config/env.ts docker-compose.yml dev.sh apps/api/package.json
git commit -m "feat: add Redis config, docker service, and worker to dev.sh"
```

---

## Task 4: Image Processing Queue and Worker

**Files:**
- Create: `apps/api/src/queues/image-processing.queue.ts`
- Create: `apps/api/src/workers/image-processing.worker.ts`
- Create: `apps/api/src/worker.ts`

- [ ] **Step 1: Create the queue definition and enqueue helper**

Create `apps/api/src/queues/image-processing.queue.ts`:

```typescript
import { Queue } from "bullmq";
import { getRedisConnection } from "../config/redis";

export interface ImageProcessingJob {
  imageId: string;
  postId: string;
  originalUrl: string;
  firebasePath: string;
}

let queue: Queue<ImageProcessingJob> | null = null;

export function getImageProcessingQueue(): Queue<ImageProcessingJob> {
  if (!queue) {
    queue = new Queue<ImageProcessingJob>("image-processing", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export async function enqueueImageProcessing(job: ImageProcessingJob): Promise<void> {
  await getImageProcessingQueue().add("process-image", job, {
    timeout: 30_000,
  });
}
```

- [ ] **Step 2: Create the job handler**

Create `apps/api/src/workers/image-processing.worker.ts`:

```typescript
import sharp from "sharp";
import { encode } from "blurhash";
import { getStorage } from "firebase-admin/storage";
import { prisma } from "../config/database";
import type { ImageProcessingJob } from "../queues/image-processing.queue";

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || "";

export async function processImage(job: ImageProcessingJob): Promise<void> {
  const { imageId, postId, firebasePath } = job;

  // Check image still exists (post may have been deleted)
  const image = await prisma.postImage.findUnique({ where: { id: imageId } });
  if (!image) return;

  const bucket = getStorage().bucket(BUCKET_NAME);

  // Download original
  const [buffer] = await bucket.file(firebasePath).download();

  // Detect animated images (GIF) — skip processing
  const metadata = await sharp(buffer).metadata();
  if (metadata.pages && metadata.pages > 1) {
    await prisma.postImage.update({
      where: { id: imageId },
      data: { status: "ready" },
    });
    return;
  }

  // Generate full-size WebP (max 1200px wide, 80% quality)
  const fullBuffer = await sharp(buffer)
    .rotate() // auto-rotate based on EXIF
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Generate thumbnail (400px wide, 70% quality)
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();

  // Compute blur hash from thumbnail
  const blurInput = await sharp(thumbBuffer)
    .raw()
    .ensureAlpha()
    .resize({ width: 32, height: 32, fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const blurHash = encode(
    new Uint8ClampedArray(blurInput.data),
    blurInput.info.width,
    blurInput.info.height,
    4,
    3
  );

  // Build storage paths from the original path
  // Original: posts/{postId}/original/{uuid}.ext
  // Full:     posts/{postId}/full/{uuid}.webp
  // Thumb:    posts/{postId}/thumb/{uuid}.webp
  const baseName = firebasePath.split("/").pop()!.replace(/\.[^.]+$/, "");
  const fullPath = `posts/${postId}/full/${baseName}.webp`;
  const thumbPath = `posts/${postId}/thumb/${baseName}.webp`;

  // Upload processed images
  const fullFile = bucket.file(fullPath);
  await fullFile.save(fullBuffer, { metadata: { contentType: "image/webp" } });
  await fullFile.makePublic();

  const thumbFile = bucket.file(thumbPath);
  await thumbFile.save(thumbBuffer, { metadata: { contentType: "image/webp" } });
  await thumbFile.makePublic();

  const fullUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fullPath}`;
  const thumbUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${thumbPath}`;

  // Update database record
  await prisma.postImage.update({
    where: { id: imageId },
    data: { fullUrl, thumbUrl, blurHash, status: "ready" },
  });
}
```

- [ ] **Step 3: Create the worker entrypoint**

Create `apps/api/src/worker.ts`:

```typescript
import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./config/redis";
import { processImage } from "./workers/image-processing.worker";
import type { ImageProcessingJob } from "./queues/image-processing.queue";

// Initialize Firebase (same as main app)
import { initializeApp, cert, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT || "", "base64").toString()
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const worker = new Worker<ImageProcessingJob>(
  "image-processing",
  async (job) => {
    console.log(`Processing image ${job.data.imageId} for post ${job.data.postId}`);
    await processImage(job.data);
    console.log(`Completed image ${job.data.imageId}`);
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
    stalledInterval: 30_000,
  }
);

worker.on("failed", (job, err) => {
  console.error(`Image processing failed for ${job?.data.imageId}:`, err.message);
  // Mark as failed in DB on final attempt
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    import("./config/database").then(({ prisma }) =>
      prisma.postImage.update({
        where: { id: job.data.imageId },
        data: { status: "failed" },
      }).catch(() => {})
    );
  }
});

worker.on("ready", () => {
  console.log("Image processing worker ready");
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
```

- [ ] **Step 4: Verify worker compiles**

Run from `apps/api`:
```bash
npx tsx --eval "import './src/worker'; console.log('Compiles OK')" 2>&1 | head -5
```

If there are import issues, fix them before proceeding.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queues/ apps/api/src/workers/ apps/api/src/worker.ts
git commit -m "feat: add BullMQ image processing queue and worker"
```

---

## Task 5: Update Upload Service — EXIF Strip + Organized Paths

**Files:**
- Modify: `apps/api/src/services/upload.service.ts`

- [ ] **Step 1: Rewrite upload service with EXIF strip and organized paths**

Replace the entire content of `apps/api/src/services/upload.service.ts`:

```typescript
import sharp from "sharp";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { HttpError } from "../utils/errors";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || "";

export interface UploadResult {
  url: string;
  firebasePath: string;
}

export async function uploadImage(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
  postId: string
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new HttpError(400, `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(", ")}`);
  }
  if (fileBuffer.length > MAX_SIZE) {
    throw new HttpError(400, "File too large. Maximum size is 10MB");
  }

  // Strip EXIF metadata, preserve orientation
  const strippedBuffer = await sharp(fileBuffer)
    .rotate() // auto-rotate based on EXIF before stripping
    .toBuffer();

  const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  const uuid = randomUUID();
  const firebasePath = `posts/${postId}/original/${uuid}.${ext}`;

  const bucket = getStorage().bucket(BUCKET_NAME);
  const file = bucket.file(firebasePath);

  await file.save(strippedBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: { originalName },
    },
  });

  await file.makePublic();

  const url = `https://storage.googleapis.com/${BUCKET_NAME}/${firebasePath}`;

  return { url, firebasePath };
}

export async function deleteImage(imageUrl: string) {
  try {
    const path = imageUrl.split(`${BUCKET_NAME}/`)[1];
    if (!path) return;
    const bucket = getStorage().bucket(BUCKET_NAME);
    await bucket.file(path).delete();
  } catch {
    // Image may already be deleted — don't fail
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/services/upload.service.ts
git commit -m "feat: add EXIF stripping and organized storage paths to upload service"
```

---

## Task 6: Update Posts Service — Enqueue Jobs + Reorder

**Files:**
- Modify: `apps/api/src/services/posts.service.ts`

- [ ] **Step 1: Add the import for enqueueImageProcessing at top of file**

Add after the existing imports (after line 2):

```typescript
import { enqueueImageProcessing } from "../queues/image-processing.queue";
```

- [ ] **Step 2: Update addPostImages to accept UploadResult and enqueue jobs**

Replace the `addPostImages` function (lines 404-418):

```typescript
import type { UploadResult } from "../services/upload.service";

export async function addPostImages(postId: string, userId: string, uploads: UploadResult[]) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "Not authorized");

  const existing = await prisma.postImage.count({ where: { postId } });

  const images = await prisma.$transaction(
    uploads.map((upload, i) =>
      prisma.postImage.create({
        data: {
          postId,
          url: upload.url,
          order: existing + i,
          status: "processing",
        },
      })
    )
  );

  // Enqueue processing jobs
  await Promise.all(
    images.map((image, i) =>
      enqueueImageProcessing({
        imageId: image.id,
        postId,
        originalUrl: uploads[i].url,
        firebasePath: uploads[i].firebasePath,
      })
    )
  );

  return images;
}
```

- [ ] **Step 3: Add reorderPostImages function**

Add after the `deletePostImage` function (after line 429):

```typescript
export async function reorderPostImages(postId: string, userId: string, imageIds: string[]) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "Not authorized");

  // Verify all IDs belong to this post
  const images = await prisma.postImage.findMany({ where: { postId } });
  const existingIds = new Set(images.map((img) => img.id));
  for (const id of imageIds) {
    if (!existingIds.has(id)) {
      throw new HttpError(400, `Image ${id} does not belong to this post`);
    }
  }

  // Update order based on array position
  await prisma.$transaction(
    imageIds.map((id, order) =>
      prisma.postImage.update({ where: { id }, data: { order } })
    )
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/posts.service.ts
git commit -m "feat: add image job enqueuing and reorder to posts service"
```

---

## Task 7: Update Posts Route — Return Images + Reorder Endpoint

**Files:**
- Modify: `apps/api/src/routes/posts.ts`

- [ ] **Step 1: Update imports**

Replace the imports at the top of the file (lines 7-15):

```typescript
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
```

- [ ] **Step 2: Rewrite the image upload route handler**

Replace the image upload route (lines 66-81). The key change: `uploadImage` now takes `postId` and returns `{ url, firebasePath }`, and `addPostImages` returns image records:

```typescript
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
```

- [ ] **Step 3: Add the reorder endpoint**

Add after the image upload route (before the delete image route):

```typescript
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
```

- [ ] **Step 4: Verify API compiles**

Run from `apps/api`:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing unrelated ones).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/posts.ts
git commit -m "feat: return image records from upload, add reorder endpoint"
```

---

## Task 8: Update Shared Types

**Files:**
- Modify: `packages/shared/src/types/post.ts`

- [ ] **Step 1: Update PostImage interface**

Replace the `PostImage` interface (lines 38-43):

```typescript
export type ImageStatus = "processing" | "ready" | "failed";

export interface PostImage {
  id: string;
  postId: string;
  url: string;
  fullUrl: string | null;
  thumbUrl: string | null;
  blurHash: string | null;
  status: ImageStatus;
  order: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/types/post.ts
git commit -m "feat: add image processing fields to shared PostImage type"
```

---

## Task 9: Update Shared API Client

**Files:**
- Modify: `packages/shared/src/api-client/posts.ts`

- [ ] **Step 1: Add deleteImage and reorderImages methods**

Add these two methods inside the returned object in `createPostsApi`, after `uploadImages` (after line 57):

```typescript
    async deleteImage(imageId: string): Promise<void> {
      await client.request<void>(`/api/posts/images/${imageId}`, {
        method: "DELETE",
      });
    },

    async reorderImages(postId: string, imageIds: string[]): Promise<void> {
      await client.request<void>(`/api/posts/${postId}/images/reorder`, {
        method: "PATCH",
        body: { imageIds },
      });
    },
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/api-client/posts.ts
git commit -m "feat: add deleteImage and reorderImages to shared API client"
```

---

## Task 10: Install Web Dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install packages**

Run from `apps/web`:
```bash
pnpm add browser-image-compression @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-blurhash
```

- [ ] **Step 2: Verify installation**

Run from project root:
```bash
node -e "require('@dnd-kit/core'); require('browser-image-compression'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add image upload dependencies to web app"
```

---

## Task 11: Create Web ImageUploadGrid Component

**Files:**
- Create: `apps/web/src/components/ImageUploadGrid.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/ImageUploadGrid.tsx`:

```tsx
"use client";

import { useRef, useCallback, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { APP_CONFIG } from "@uchicago-marketplace/shared";

// --- Types ---

export type ImageItem =
  | { type: "local"; id: string; file: File; previewUrl: string }
  | { type: "remote"; id: string; image: { id: string; url: string; thumbUrl?: string | null } };

interface ImageUploadGridProps {
  images: ImageItem[];
  onImagesChange: (images: ImageItem[]) => void;
  maxImages?: number;
}

// --- Compression ---

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
  fileType: "image/webp" as const,
};

async function compressFile(file: File): Promise<File> {
  try {
    return await imageCompression(file, COMPRESSION_OPTIONS);
  } catch {
    // If compression fails (e.g. unsupported format), return original
    return file;
  }
}

// --- Sortable Thumbnail ---

function SortableImage({
  item,
  index,
  onRemove,
}: {
  item: ImageItem;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const src = item.type === "local" ? item.previewUrl : (item.image.thumbUrl || item.image.url);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-lg overflow-hidden group"
      {...attributes}
      {...listeners}
    >
      <img src={src} alt={`Image ${index + 1}`} className="w-full h-full object-cover" />
      {index === 0 && (
        <span className="absolute top-1.5 left-1.5 bg-maroon-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Cover
        </span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
      >
        &times;
      </button>
      <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-lg pointer-events-none" />
    </div>
  );
}

// --- Main Component ---

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/heic";

export function ImageUploadGrid({
  images,
  onImagesChange,
  maxImages = APP_CONFIG.maxImagesPerPost,
}: ImageUploadGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);
  const remaining = maxImages - images.length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, remaining);
      if (fileArray.length === 0) return;

      // Validate types
      const validFiles = fileArray.filter((f) =>
        ["image/jpeg", "image/png", "image/webp", "image/heic"].includes(f.type)
      );
      if (validFiles.length === 0) return;

      // Validate sizes (reject > 10MB)
      const sizedFiles = validFiles.filter((f) => f.size <= 10 * 1024 * 1024);

      setCompressing(true);
      try {
        const compressed = await Promise.all(sizedFiles.map(compressFile));
        const newItems: ImageItem[] = compressed.map((file) => ({
          type: "local",
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        onImagesChange([...images, ...newItems].slice(0, maxImages));
      } finally {
        setCompressing(false);
      }
    },
    [images, onImagesChange, maxImages, remaining]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      onImagesChange(arrayMove(images, oldIndex, newIndex));
    },
    [images, onImagesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const item = images[index];
      if (item.type === "local") {
        URL.revokeObjectURL(item.previewUrl);
      }
      onImagesChange(images.filter((_, i) => i !== index));
    },
    [images, onImagesChange]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Photos</span>
        <span className="text-xs text-gray-400">
          {images.length}/{maxImages} photos
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-4 gap-2">
            {images.map((item, i) => (
              <SortableImage
                key={item.id}
                item={item}
                index={i}
                onRemove={() => removeImage(i)}
              />
            ))}

            {remaining > 0 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                disabled={compressing}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
              >
                {compressing ? (
                  <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span className="text-[10px] mt-0.5">Add</span>
                  </>
                )}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="text-[11px] text-gray-400 mt-1.5">
        Drag to reorder. First image is the cover photo.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run from `apps/web`:
```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors from this file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ImageUploadGrid.tsx
git commit -m "feat: create web ImageUploadGrid component with drag-and-drop"
```

---

## Task 12: Integrate ImageUploadGrid into Web Create Form

**Files:**
- Modify: `apps/web/src/app/create/page.tsx`

- [ ] **Step 1: Add imports and image state**

Add the import at the top of the file (after line 5):

```typescript
import { ImageUploadGrid, type ImageItem } from "@/components/ImageUploadGrid";
```

Add image state after the `error` state declaration (after line 89):

```typescript
const [images, setImages] = useState<ImageItem[]>([]);
```

- [ ] **Step 2: Add ImageUploadGrid to each Step 3 renderer**

In `renderStep3Marketplace()`, add after the closing `</div>` of `<div className="space-y-5">` (the last `</div>` before the function's return closing):

Insert before the final `</div>` of the function, after the space-y-5 div closes:

```tsx
        {/* Divider */}
        <div className="border-t border-gray-200 my-6" />

        {/* Images */}
        <ImageUploadGrid images={images} onImagesChange={setImages} />
```

Do the same for `renderStep3Storage()` and `renderStep3Housing()` — add the same divider + ImageUploadGrid block at the end of each function's main content div.

- [ ] **Step 3: Update handleSubmit to upload images after post creation**

Replace the `handleSubmit` function (lines 249-273):

```typescript
  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Request failed (${res.status})`);
      }
      const post = await res.json();

      // Upload images if any
      const localImages = images.filter((img): img is Extract<ImageItem, { type: "local" }> => img.type === "local");
      if (localImages.length > 0) {
        const formData = new FormData();
        localImages.forEach((img) => {
          formData.append("images", img.file);
        });

        const uploadRes = await fetch(`${API_URL}/api/posts/${post.id}/images`, {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        });
        if (!uploadRes.ok) {
          // Post was created but images failed — redirect anyway, user can add via edit
          console.error("Image upload failed:", await uploadRes.text());
        }
      }

      router.push(`/posts/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }
```

- [ ] **Step 4: Show image previews in renderStep4 (Review step)**

In `renderStep4()`, add after the type-specific details section (after the `</div>` that closes `<div className="bg-gray-50 rounded-xl p-4 space-y-2">`):

```tsx
          {/* Image preview */}
          {images.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Photos ({images.length})</h4>
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, i) => (
                  <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden">
                    <img
                      src={img.type === "local" ? img.previewUrl : img.image.url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {i === 0 && (
                      <span className="absolute top-1 left-1 bg-maroon-600 text-white text-[9px] font-bold px-1 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 5: Verify the page renders**

Run:
```bash
cd apps/web && npx next build 2>&1 | tail -10
```

Expected: Build succeeds or has only pre-existing warnings.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/create/page.tsx
git commit -m "feat: integrate ImageUploadGrid into web create form"
```

---

## Task 13: Create Web Edit Page with Image Management

**Files:**
- Create: `apps/web/src/app/posts/[id]/edit/page.tsx`

- [ ] **Step 1: Create the edit page**

Create `apps/web/src/app/posts/[id]/edit/page.tsx`:

```tsx
"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ImageUploadGrid, type ImageItem } from "@/components/ImageUploadGrid";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PostData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  side: string;
  authorId: string;
  marketplace: {
    priceType: string;
    priceAmount: number | null;
    condition: string;
    category: string;
    tradeDescription: string | null;
    tags: string[];
  } | null;
  storage: {
    startDate: string;
    endDate: string;
    size: string;
    locationType: string;
    neighborhood: string | null;
    priceMonthly: number | null;
    isFree: boolean;
    restrictions: string | null;
  } | null;
  housing: {
    subtype: string;
    side: string;
    monthlyRent: number;
    bedrooms: string;
    bathrooms: string;
    neighborhood: string | null;
    amenities: string[];
    roommates: string;
    roommateCount: number | null;
    moveInDate: string | null;
    moveOutDate: string | null;
    leaseStartDate: string | null;
    leaseDurationMonths: number | null;
  } | null;
  images: { id: string; url: string; thumbUrl: string | null; fullUrl: string | null; order: number }[];
}

export default function EditPostPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch post data
  useEffect(() => {
    if (!accessToken || !postId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/posts/${postId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Post not found");
        const data = await res.json();
        setPost(data);
        setTitle(data.title);
        setDescription(data.description || "");

        // Convert existing images to ImageItem format
        const existingImages: ImageItem[] = data.images
          .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
          .map((img: { id: string; url: string; thumbUrl: string | null }) => ({
            type: "remote" as const,
            id: img.id,
            image: { id: img.id, url: img.url, thumbUrl: img.thumbUrl },
          }));
        setImages(existingImages);
        setOriginalImageIds(data.images.map((img: { id: string }) => img.id));
      } catch {
        setError("Failed to load post");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, postId]);

  // Redirect if not owner
  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
    if (post && user && post.authorId !== user.id) router.push(`/posts/${postId}`);
  }, [authLoading, user, post, postId, router]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !post) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. Update post text fields
      await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
      });

      // 2. Delete removed images
      const currentRemoteIds = images
        .filter((img): img is Extract<ImageItem, { type: "remote" }> => img.type === "remote")
        .map((img) => img.image.id);
      const deletedIds = originalImageIds.filter((id) => !currentRemoteIds.includes(id));

      await Promise.all(
        deletedIds.map((id) =>
          fetch(`${API_URL}/api/posts/images/${id}`, {
            method: "DELETE",
            credentials: "include",
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        )
      );

      // 3. Upload new images
      const newImages = images.filter(
        (img): img is Extract<ImageItem, { type: "local" }> => img.type === "local"
      );
      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach((img) => formData.append("images", img.file));
        await fetch(`${API_URL}/api/posts/${postId}/images`, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
      }

      // 4. Reorder (send all image IDs in new order — new images won't have server IDs yet,
      //    so only reorder existing remote images)
      const reorderedIds = images
        .filter((img): img is Extract<ImageItem, { type: "remote" }> => img.type === "remote")
        .map((img) => img.image.id);
      if (reorderedIds.length > 0) {
        await fetch(`${API_URL}/api/posts/${postId}/images/reorder`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ imageIds: reorderedIds }),
        });
      }

      router.push(`/posts/${postId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, post, postId, title, description, images, originalImageIds, router]);

  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Post not found</p>
      </div>
    );
  }

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
          <span className="hidden sm:inline text-sm font-medium text-gray-400 uppercase tracking-wider">
            Marketplace
          </span>
        </Link>
        <Link
          href={`/posts/${postId}`}
          className="text-sm font-medium text-gray-600 hover:text-maroon-600 transition-colors"
        >
          Cancel
        </Link>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Edit Post</h1>
        <p className="text-sm text-gray-500 mb-6">Update your listing details.</p>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {error && (
            <div className="text-sm text-maroon-700 bg-maroon-100 rounded-lg px-3 py-2.5 mb-6">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>
                Title <span className="text-maroon-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/80</p>
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputClass + " resize-none"}
              />
            </div>

            <div className="border-t border-gray-200 my-6" />

            <ImageUploadGrid images={images} onImagesChange={setImages} />
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <Link
              href={`/posts/${postId}`}
              className="text-sm font-semibold text-gray-600 border border-gray-300 px-5 py-2.5 rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !title.trim()}
              className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-6 py-2.5 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run from `apps/web`:
```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/posts/\[id\]/edit/page.tsx
git commit -m "feat: create web edit page with image management"
```

---

## Task 14: Update Web Browse Page — Thumbnail + Blur Hash

**Files:**
- Modify: `apps/web/src/app/browse/page.tsx`

- [ ] **Step 1: Add react-blurhash import**

Add at the top of the file (after line 4):

```typescript
import { Blurhash } from "react-blurhash";
```

- [ ] **Step 2: Update PostImage type to include new fields**

Replace the `PostImage` interface (lines 81-83):

```typescript
interface PostImage {
  url: string;
  thumbUrl: string | null;
  blurHash: string | null;
  status: string;
}
```

- [ ] **Step 3: Update PostCard to use thumbUrl and blur hash**

In the `PostCard` component, replace the image rendering section (the `<div className="relative aspect-[4/3]...">` block, approximately lines 184-199):

```tsx
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <>
            {post.images[0]?.blurHash && (
              <div className="absolute inset-0">
                <Blurhash hash={post.images[0].blurHash} width="100%" height="100%" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={post.title}
              className="relative w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}
      </div>
```

Also update the `imageUrl` variable in `PostCard` (line 176) to prefer `thumbUrl`:

```typescript
const imageUrl = post.images.length > 0 ? (post.images[0].thumbUrl || post.images[0].url) : null;
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/browse/page.tsx
git commit -m "feat: use thumbnail and blur hash in browse page post cards"
```

---

## Task 15: Update Web Post Detail — Optimized ImageGallery

**Files:**
- Modify: `apps/web/src/app/posts/[id]/page.tsx`

- [ ] **Step 1: Add blur hash import**

Add at the top of the file (after line 6):

```typescript
import { Blurhash } from "react-blurhash";
```

- [ ] **Step 2: Update PostImage interface**

Replace the local `PostImage` interface (lines 26-29):

```typescript
interface PostImage {
  id: string;
  url: string;
  fullUrl: string | null;
  thumbUrl: string | null;
  blurHash: string | null;
  status: string;
  order: number;
}
```

- [ ] **Step 3: Update ImageGallery to use optimized URLs and blur hash**

Find the `ImageGallery` component in the file. Update the main image `<img>` tag to use `fullUrl` with blur hash placeholder, and the thumbnails to use `thumbUrl`. The main image `src` should be:

```typescript
const mainSrc = images[selected].fullUrl || images[selected].url;
```

For the main image display, add a blur hash backdrop:

```tsx
<div className="relative w-full aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden">
  {images[selected]?.blurHash && (
    <div className="absolute inset-0">
      <Blurhash hash={images[selected].blurHash} width="100%" height="100%" />
    </div>
  )}
  <img
    src={mainSrc}
    alt={`Image ${selected + 1}`}
    className="relative w-full h-full object-contain"
  />
</div>
```

For thumbnail images, use `thumbUrl`:

```typescript
const thumbSrc = img.thumbUrl || img.url;
```

- [ ] **Step 4: Add Edit link to post detail page**

In the post detail page, somewhere near the post title/actions area (where the owner sees delete/mark-sold buttons), add a link:

```tsx
{post.author.id === user?.id && (
  <Link
    href={`/posts/${post.id}/edit`}
    className="text-sm font-medium text-maroon-600 hover:text-maroon-700"
  >
    Edit
  </Link>
)}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/posts/\[id\]/page.tsx
git commit -m "feat: update ImageGallery with blur hash and optimized URLs, add edit link"
```

---

## Task 16: Install Mobile Dependencies

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install packages**

Run from `apps/mobile`:
```bash
npx expo install expo-image-manipulator react-native-draggable-flatlist react-native-gesture-handler
```

Note: `react-native-gesture-handler` is required by `react-native-draggable-flatlist`. `expo-image-manipulator` is part of the Expo SDK.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat: add mobile image processing dependencies"
```

---

## Task 17: Upgrade Mobile ImagePickerGrid

**Files:**
- Modify: `apps/mobile/components/ImagePickerGrid.tsx`

- [ ] **Step 1: Rewrite with compression, drag-and-drop, and cover badge**

Replace the entire content of `apps/mobile/components/ImagePickerGrid.tsx`:

```tsx
import { View, Text, Pressable, Image, Alert, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { APP_CONFIG } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { useCallback } from "react";

interface ImagePickerGridProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
}

const MAX = APP_CONFIG.maxImagesPerPost;

async function compressImage(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri; // Return original if compression fails
  }
}

export function ImagePickerGrid({
  images,
  onImagesChange,
}: ImagePickerGridProps) {
  const remaining = MAX - images.length;

  async function pickFromLibrary() {
    if (remaining <= 0) {
      Alert.alert("Limit reached", `You can add up to ${MAX} photos.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      const compressed = await Promise.all(
        result.assets.map((a) => compressImage(a.uri))
      );
      onImagesChange([...images, ...compressed].slice(0, MAX));
    }
  }

  async function takePhoto() {
    if (remaining <= 0) {
      Alert.alert("Limit reached", `You can add up to ${MAX} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const compressed = await compressImage(result.assets[0].uri);
      onImagesChange([...images, compressed].slice(0, MAX));
    }
  }

  function removeImage(index: number) {
    const next = [...images];
    next.splice(index, 1);
    onImagesChange(next);
  }

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<string>) => {
      const index = getIndex() ?? 0;
      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            disabled={isActive}
            style={[styles.thumbWrapper, isActive && styles.dragging]}
          >
            <Image source={{ uri: item }} style={styles.thumb} />
            {index === 0 && (
              <View style={styles.coverBadge}>
                <Text style={styles.coverText}>Cover</Text>
              </View>
            )}
            <Pressable style={styles.removeBtn} onPress={() => removeImage(index)}>
              <FontAwesome name="times" size={10} color={colors.white} />
            </Pressable>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [images]
  );

  return (
    <GestureHandlerRootView>
      <View style={styles.container}>
        <Text style={styles.counter}>
          {images.length}/{MAX} photos
        </Text>

        {images.length > 0 && (
          <DraggableFlatList
            data={images}
            onDragEnd={({ data }) => onImagesChange(data)}
            keyExtractor={(item, i) => `${item}-${i}`}
            renderItem={renderItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}

        {remaining > 0 && (
          <View style={styles.buttons}>
            <Pressable style={styles.addBtn} onPress={pickFromLibrary}>
              <FontAwesome name="photo" size={20} color={colors.gray[400]} />
              <Text style={styles.addLabel}>Library</Text>
            </Pressable>

            <Pressable style={styles.addBtn} onPress={takePhoto}>
              <FontAwesome name="camera" size={20} color={colors.gray[400]} />
              <Text style={styles.addLabel}>Camera</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.hint}>Long press & drag to reorder. First photo is the cover.</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const THUMB_SIZE = 88;

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  counter: {
    fontSize: 13,
    color: colors.gray[500],
    fontWeight: "500",
  },
  listContent: {
    gap: 10,
    paddingVertical: 4,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: "hidden",
  },
  dragging: {
    opacity: 0.7,
    transform: [{ scale: 1.05 }],
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
  },
  coverBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(128,0,0,0.85)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
  },
  addBtn: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.gray[300],
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addLabel: {
    fontSize: 10,
    color: colors.gray[400],
    fontWeight: "500",
  },
  hint: {
    fontSize: 11,
    color: colors.gray[400],
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/components/ImagePickerGrid.tsx
git commit -m "feat: upgrade mobile ImagePickerGrid with compression, drag-and-drop, cover badge"
```

---

## Task 18: Upgrade Mobile useCreatePost Hook — Per-Image Retry

**Files:**
- Modify: `apps/mobile/hooks/useCreatePost.ts`

- [ ] **Step 1: Add upload status tracking types**

Add after the existing imports (after line 2):

```typescript
export type ImageUploadStatus = "pending" | "uploading" | "done" | "failed";

export interface ImageUploadState {
  uri: string;
  status: ImageUploadStatus;
}
```

- [ ] **Step 2: Replace the submit function**

Replace the `submit` callback (lines 210-246) with a version that tracks per-image status and supports retry:

```typescript
  const [uploadStates, setUploadStates] = useState<ImageUploadState[]>([]);

  const submit = useCallback(async (): Promise<string | null> => {
    const payload = buildPayload();
    if (!payload) {
      update({ error: "Invalid post data" });
      return null;
    }

    update({ isSubmitting: true, error: null });

    try {
      const post = await api.posts.create(payload);

      // Upload images if any
      if (state.images.length > 0) {
        const states: ImageUploadState[] = state.images.map((uri) => ({ uri, status: "uploading" as const }));
        setUploadStates(states);

        const formData = new FormData();
        state.images.forEach((uri, i) => {
          const filename = uri.split("/").pop() || `photo_${i}.jpg`;
          const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
          const mimeType = ext === "png" ? "image/png" : "image/jpeg";
          formData.append("images", {
            uri,
            name: filename,
            type: mimeType,
          } as unknown as Blob);
        });

        try {
          await api.posts.uploadImages(post.id, formData);
          setUploadStates((prev) => prev.map((s) => ({ ...s, status: "done" })));
        } catch {
          setUploadStates((prev) => prev.map((s) => ({ ...s, status: "failed" })));
          // Post was created but images failed — still return postId
          // User can retry via edit
        }
      }

      const postId = post.id;
      setState({ ...INITIAL_STATE });
      setUploadStates([]);
      return postId;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post";
      update({ isSubmitting: false, error: message });
      return null;
    }
  }, [buildPayload, state.images, update]);
```

- [ ] **Step 3: Expose uploadStates in the return object**

Update the return statement (around line 252) to include `uploadStates`:

```typescript
  return {
    state,
    update,
    goToStep,
    nextStep,
    prevStep,
    canAdvance,
    buildPayload,
    submit,
    reset,
    uploadStates,
  };
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/useCreatePost.ts
git commit -m "feat: add per-image upload status tracking to mobile useCreatePost"
```

---

## Task 19: Add Mobile Edit Screen with Image Management

**Files:**
- Modify: `apps/mobile/app/posts/[id].tsx` (or create a separate edit screen if the app uses a different pattern)

- [ ] **Step 1: Identify the mobile edit flow entry point**

Check how the mobile app currently handles post editing. Look for an edit button or screen in the post detail screen (`apps/mobile/app/posts/[id].tsx`). If no edit screen exists, create one at `apps/mobile/app/posts/[id]/edit.tsx`.

The edit screen should:
1. Fetch the existing post data (including images)
2. Render the `ImagePickerGrid` component pre-populated with existing images from URLs
3. Allow adding new images (from library/camera), removing existing ones, and reordering via drag-and-drop
4. On save:
   - Delete removed images via `DELETE /api/posts/images/:imageId`
   - Upload new images via `POST /api/posts/:id/images`
   - Reorder via `PATCH /api/posts/:id/images/reorder`
   - Update text fields via `PATCH /api/posts/:id`

Note: The `ImagePickerGrid` currently takes `string[]` (URIs). For edit mode, existing images come as remote URLs. The component already renders URLs via `<Image source={{ uri }}>`, so remote URLs work without changes — just pass them as strings alongside local URIs.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat: add mobile edit screen with image management"
```

---

## Task 20: Update Mobile Post Detail — Blur Hash + Optimized URLs

**Files:**
- Modify: `apps/mobile/app/posts/[id].tsx`

- [ ] **Step 1: Update the PostImage type used in the mobile post detail screen**

Find the `PostImage` or equivalent interface in the file and add the new fields:

```typescript
interface PostImage {
  id: string;
  url: string;
  fullUrl: string | null;
  thumbUrl: string | null;
  blurHash: string | null;
  status: string;
  order: number;
}
```

- [ ] **Step 2: Update image rendering to use fullUrl with blur hash**

If the screen uses `expo-image` (from `expo-image` package), update the image source to prefer `fullUrl` and pass `blurHash` as placeholder:

```tsx
import { Image } from "expo-image";

// In the image display:
<Image
  source={{ uri: image.fullUrl || image.url }}
  placeholder={{ blurhash: image.blurHash ?? undefined }}
  style={styles.image}
  contentFit="cover"
  transition={200}
/>
```

If the screen currently uses React Native's `Image`, replace with `expo-image` for blur hash support. If `expo-image` is not installed:

```bash
npx expo install expo-image
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/posts/\[id\].tsx apps/mobile/package.json
git commit -m "feat: update mobile post detail with blur hash and optimized URLs"
```

---

## Task 21: Final Verification

- [ ] **Step 1: Start all services**

```bash
docker-compose up -d db redis
./dev.sh
```

- [ ] **Step 2: Run Prisma migration in dev**

```bash
cd apps/api && npx prisma migrate dev
```

- [ ] **Step 3: Test the full flow**

1. Open http://localhost:3001
2. Log in
3. Navigate to Create Post
4. Select Marketplace type, fill in details
5. Add images via the upload grid — verify compression, drag-and-drop, cover badge
6. Submit — verify images upload and post is created
7. View the post detail — verify images display
8. Wait a few seconds — verify blur hash appears, then full-size image loads
9. Navigate to edit — verify existing images appear, can add/remove/reorder
10. Browse page — verify thumbnails load

- [ ] **Step 4: Verify worker is processing**

Check the terminal output for the worker process — should see "Processing image..." and "Completed image..." messages.

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
