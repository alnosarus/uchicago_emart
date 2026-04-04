# Image Upload System — Design Spec

## Overview

Comprehensive image upload system across web, mobile, and API. Covers the full lifecycle: client-side compression, upload, server-side processing (resize, WebP, thumbnail, blur hash, EXIF strip), drag-and-drop reordering, edit-flow image management, and optimized display with blur hash placeholders.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Processing architecture | Background job queue (BullMQ + Redis) | Non-blocking uploads, API stays responsive, retries built in |
| Processing pipeline | Resize + WebP + thumbnail + blur hash + EXIF strip | Fast page loads, polished loading UX, user privacy |
| Image reordering | Drag-and-drop on both platforms | First image = cover photo, intuitive UX |
| Upload timing | Upload on submit | No orphan cleanup needed, simpler architecture |
| Web form placement | Images below details on Step 2 (combined) | Keeps form at 4 steps, structured data prioritized |
| Web layout | Details first, images below | Form fields feel primary, images are optional/additive |
| Edit flow | Full management (add, remove, reorder) | Parity with creation experience |
| Client-side processing | Auto-compress, no crop/rotate tools | Saves bandwidth without complicating UX |
| Error handling | Partial success with per-image retry | Users don't lose work, can recover from individual failures |
| Platform parity | Full parity between web and mobile | Consistent experience regardless of platform |

## 1. API — Image Processing Pipeline

### Upload Endpoint (existing, modified)

`POST /api/posts/:id/images` — Multer with memoryStorage, `multipart/form-data`, field name `images`.

**On upload:**
1. Validate file type (jpeg, png, webp, heic) and size (max 10MB raw — `APP_CONFIG.maxImageSizeMB` is 5MB as the client target, but the server allows 10MB headroom for uncompressed uploads from older clients or compression bypass)
2. Strip EXIF metadata with `sharp`
3. Store original in Firebase Storage at `posts/{postId}/original/{uuid}.{ext}`
4. Create `PostImage` record with `status: processing`
5. Return immediately with the image record
6. Enqueue BullMQ job for async processing

### Processing Worker

Separate process (`src/worker.ts`), single queue: `image-processing`.

**Job payload:**
```typescript
{
  imageId: string;
  postId: string;
  originalUrl: string;
  firebasePath: string; // e.g. posts/{postId}/original/{uuid}.webp
}
```

**Processing steps:**
1. Download original from Firebase
2. **Full-size WebP**: resize to max 1200px wide, 80% quality → `posts/{postId}/full/{uuid}.webp`
3. **Thumbnail**: resize to 400px wide, 70% quality → `posts/{postId}/thumb/{uuid}.webp`
4. **Blur hash**: compute from thumbnail using `blurhash` library
5. Update `PostImage` with `fullUrl`, `thumbUrl`, `blurHash`, `status: ready`

**Job config:** 3 retries, exponential backoff, 30s timeout. On final failure: `status: failed`, original URL still serves.

### New Endpoint — Reorder

`PATCH /api/posts/:id/images/reorder`

**Body:** `{ imageIds: string[] }` — updates `order` based on array position. Validates all IDs belong to the post and the requester owns the post.

### Schema Changes

```prisma
model PostImage {
  id        String      @id @default(uuid())
  postId    String
  url       String           // original URL (fallback)
  fullUrl   String?          // processed 1200px WebP
  thumbUrl  String?          // 400px thumbnail WebP
  blurHash  String?          // blur hash string
  status    ImageStatus @default(processing)
  order     Int         @default(0)
  createdAt DateTime    @default(now())
  post      Post        @relation(fields: [postId], references: [id], onDelete: Cascade)

  @@index([postId])
}

enum ImageStatus {
  processing
  ready
  failed
}
```

### New Dependencies (apps/api)

- `bullmq` — job queue
- `ioredis` — Redis client (BullMQ peer dep)
- `sharp` — image processing (move from root devDep to api dep)
- `blurhash` (npm: `blurhash`) — blur hash encoding (uses `encode()` from this package)

## 2. Web — Image Upload Component & Form Integration

### New Component: `ImageUploadGrid`

**Location:** `apps/web/src/components/ImageUploadGrid.tsx`

**Props:**
```typescript
interface ImageUploadGridProps {
  images: ImageItem[];           // mixed local files + remote URLs
  onImagesChange: (images: ImageItem[]) => void;
  maxImages?: number;            // default: APP_CONFIG.maxImagesPerPost (8)
}

type ImageItem =
  | { type: 'local'; file: File; previewUrl: string }
  | { type: 'remote'; image: PostImage };
```

**Behavior:**
- Drop zone + click-to-browse file picker
- Validates file type (jpeg, png, webp, heic) and size (max 10MB) client-side
- **Client-side compression**: `browser-image-compression` — resize >1200px, compress to ~1MB target, preserve aspect ratio
- Shows thumbnail previews from `URL.createObjectURL()`
- Displays count: "X/8 photos"
- **Drag-and-drop reordering**: `@dnd-kit/core` + `@dnd-kit/sortable` — first image shows "Cover" badge
- X button on each thumbnail to remove
- Supports both click-to-add and drag-files-from-desktop

**New dependencies (apps/web):**
- `browser-image-compression` — client-side image compression
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop

### Create Flow Integration

**File:** `apps/web/src/app/create/page.tsx`

Step 2 (Details) gets `ImageUploadGrid` below existing form fields, separated by a divider. Images stored as `File[]` in component state — not uploaded until submit.

**Submit flow (Step 4 → publish):**
1. `POST /api/posts` — create the post (existing)
2. If images exist: build `FormData`, `POST /api/posts/:id/images`
3. On partial failure: show retry UI per failed image

**Review step (Step 4):** renders image previews from local object URLs with drag-and-drop order reflected.

### Edit Flow Integration

**File:** `apps/web/src/app/posts/[id]/edit/page.tsx`

Same `ImageUploadGrid` component, pre-populated with existing post images as `remote` items. New images added as `local` items. Both types coexist in the same drag-and-drop grid.

**Save logic:**
1. Deleted images (remote items removed) → `DELETE /api/posts/images/:imageId` for each
2. New images (local items) → `POST /api/posts/:id/images` via FormData
3. Order changed → `PATCH /api/posts/:id/images/reorder`

## 3. Mobile — Upgrades for Parity

### ImagePickerGrid Upgrades

**File:** `apps/mobile/components/ImagePickerGrid.tsx`

**Client-side compression:**
- Use `expo-image-manipulator` (already in Expo SDK) to resize >1200px and compress to ~1MB after picker returns, before adding to state

**Drag-and-drop reorder:**
- Replace static grid with `react-native-draggable-flatlist` (gesture-handler based)
- Long-press to grab, drag to reorder
- First item shows "Cover" badge

**Visual updates:**
- Count label ("X/8 photos")
- Cover badge on first image
- X button to remove

**New dependency (apps/mobile):**
- `react-native-draggable-flatlist`

### useCreatePost Hook Upgrades

**File:** `apps/mobile/hooks/useCreatePost.ts`

**Per-image status tracking:**
```typescript
type ImageUploadStatus = 'pending' | 'uploading' | 'done' | 'failed';
```

Each image tracks its own status. Grid shows indicator per thumbnail.

**Retry support:**
- On failure, track which images failed
- Expose `retryFailedUploads()` for the UI to call
- Retry only failed images, not the whole batch

### Mobile Edit Flow

Currently no image editing on mobile post edit. Add `ImagePickerGrid` to the edit screen, pre-populated with existing images (fetched as URLs). Same add/remove/reorder + same save logic as web.

## 4. Image Display — Optimized Rendering

### Shared PostImage Type Update

**File:** `packages/shared/src/types/post.ts`

```typescript
export interface PostImage {
  id: string;
  postId: string;
  url: string;              // original (fallback)
  fullUrl: string | null;   // 1200px WebP
  thumbUrl: string | null;  // 400px thumbnail WebP
  blurHash: string | null;  // blur hash placeholder
  status: 'processing' | 'ready' | 'failed';
  order: number;
}
```

### Fallback Chain

All clients use the same logic:
- `status === 'processing'` → use `url` (original, unoptimized)
- `status === 'ready'` → use `fullUrl`/`thumbUrl` (optimized)
- `status === 'failed'` → use `url` (processing failed, original is fine)

### Browse/Listing Pages (Web + Mobile)

- Post cards use `thumbUrl` (400px WebP) for fast load
- Blur hash placeholder while thumbnail loads
- Web: `react-blurhash` (npm: `react-blurhash`) component wrapping a `<canvas>` element
- Mobile: `expo-image` has native `placeholder={{ blurhash }}` prop (no extra dependency)

### Post Detail Pages

**Web (`ImageGallery` component):**
- Main image: `fullUrl` (1200px WebP), blur hash while loading
- Thumbnail strip: `thumbUrl`

**Mobile:**
- Same fallback chain, `expo-image` handles blur hash natively

## 5. Infrastructure — Redis + BullMQ

### Redis

**Local dev:** Add to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

**Production:** Provision Redis on Railway (free tier sufficient for job queue).

**Env var:** `REDIS_URL` added to `.env.example` files.

### Worker Process

**File:** `apps/api/src/worker.ts` — separate entrypoint from the API server.

**Local dev:** `dev.sh` updated to run worker alongside API + web.

**Production:** Separate Railway service, same repo, start command `npm run worker`.

### Queue Configuration

- Queue name: `image-processing`
- Concurrency: 3 (process up to 3 images simultaneously)
- Job timeout: 30s
- Retries: 3 with exponential backoff
- Stalled job check: every 30s

## 6. Error Handling & Edge Cases

### Client-Side Validation (Both Platforms)

- **File type**: reject non-image files with clear error
- **File size**: reject >10MB before compression
- **Compression failure**: skip compression, upload original — server validates
- **Max count**: disable add at 8 images, show message

### Upload Error Handling (Both Platforms)

- **Network timeout**: 60s per image, then mark failed
- **Per-image status**: `pending → uploading → done | failed`
- **Failed images**: red overlay + retry icon, per-image retry button
- **Post creation fails**: nothing uploads, user retries whole form
- **All images fail, post succeeds**: post exists imageless, retry UI shown, can also add via edit

### Processing Worker Edge Cases

- **HEIC**: `sharp` converts to WebP natively
- **Animated GIF**: detect via `sharp.metadata()`, skip processing, store original only (no thumbnail/blurhash)
- **Corrupt file**: `sharp` throws → `status: failed`, original URL still serves
- **Worker crash**: BullMQ auto-retries stalled jobs after 30s

### Race Conditions

- **Post deleted during processing**: cascade delete removes `PostImage`. Worker catches "record not found", discards job.
- **Images edited during processing**: worker updates by `imageId`, not position. Reorder operations don't conflict.
