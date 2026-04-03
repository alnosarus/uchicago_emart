# Phase 3: Social Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transactions (mark sold/completed), transaction-gated reviews, saved posts, and enriched user profiles to the UChicago eMart marketplace across API, web, and mobile.

**Architecture:** A `transactions` table records who completed a deal on each post. Reviews are gated by transaction existence. Saved posts are independent bookmarks. Profile aggregation pulls stats from all three. A `cnetId` column on `users` enables user search by unique UChicago identifier.

**Tech Stack:** Express/Prisma (API), Next.js (web), Expo/React Native (mobile), Zod (validation), shared TypeScript types via `@uchicago-marketplace/shared`.

**Spec:** `docs/superpowers/specs/2026-04-03-phase3-social-features-design.md`

---

## File Map

### New files

| File | Purpose |
|------|---------|
| `packages/shared/src/types/transaction.ts` | Transaction and TransactionWithDetails types |
| `packages/shared/src/schemas/transaction.schema.ts` | Zod schema for createTransaction |
| `packages/shared/src/api-client/reviews.ts` | API client: createReview, getReviewsForUser, checkEligibility |
| `packages/shared/src/api-client/saved.ts` | API client: savePost, unsavePost, getSavedPosts |
| `packages/shared/src/api-client/transactions.ts` | API client: createTransaction, undoTransaction |
| `packages/shared/src/api-client/users.ts` | API client: searchUsers, getProfile |
| `apps/api/src/services/transaction.service.ts` | Business logic: create/undo transactions, counts |
| `apps/api/src/services/review.service.ts` | Business logic: create review, list reviews, eligibility |
| `apps/api/src/services/saved.service.ts` | Business logic: save/unsave/list saved posts |
| `apps/api/src/routes/transactions.ts` | Route: POST /api/transactions, DELETE /api/transactions/:postId |
| `apps/api/src/routes/reviews.ts` | Route: POST /api/reviews, GET /api/reviews/eligibility |
| `apps/api/src/routes/saved.ts` | Route: POST/DELETE /api/saved/:postId, GET /api/saved |
| `apps/web/src/app/profile/[id]/page.tsx` | Web profile page |
| `apps/web/src/app/saved/page.tsx` | Web saved posts page |
| `apps/mobile/hooks/useProfile.ts` | Mobile hook: fetch enriched profile |
| `apps/mobile/hooks/useSavedPosts.ts` | Mobile hook: track saved state |
| `apps/mobile/hooks/useTransaction.ts` | Mobile hook: create/undo transaction |
| `apps/mobile/hooks/useReview.ts` | Mobile hook: submit review, check eligibility |
| `apps/mobile/app/profile/[id].tsx` | Mobile profile screen |
| `apps/mobile/app/saved.tsx` | Mobile saved posts list |

### Modified files

| File | Changes |
|------|---------|
| `apps/api/prisma/schema.prisma` | Add Transaction model, cnetId on User, relations, unique constraint on Review |
| `apps/api/src/index.ts` | Register transactions, reviews, saved routes |
| `apps/api/src/routes/users.ts` | Add search endpoint, reviews-for-user endpoint, enriched profile |
| `apps/api/src/services/auth.service.ts` | Set cnetId on user creation |
| `apps/api/src/services/posts.service.ts` | Add isSaved enrichment to list/detail |
| `apps/api/src/routes/posts.ts` | Pass userId to service for isSaved |
| `packages/shared/src/types/user.ts` | Add UserProfile, UserSearchResult, cnetId |
| `packages/shared/src/types/index.ts` | Export transaction types |
| `packages/shared/src/schemas/index.ts` | Export transaction schema |
| `packages/shared/src/api-client/index.ts` | Wire up reviews, saved, transactions, users modules |
| `apps/web/src/app/page.tsx` | Add "Saved" link in navbar |
| `apps/web/src/app/posts/[id]/page.tsx` | Add save button, mark-sold modal, review form |
| `apps/web/src/app/browse/page.tsx` | Add save button to PostCard |
| `apps/mobile/app/(tabs)/profile.tsx` | Navigate to profile/[id] when authenticated |
| `apps/mobile/app/posts/[id].tsx` | Add save, mark-sold, review UI |

---

## Task 1: Database Migration — Transaction Table + cnetId Column

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/services/auth.service.ts:71` (user creation)

- [ ] **Step 1: Add Transaction model and cnetId to Prisma schema**

Open `apps/api/prisma/schema.prisma` and make these changes:

In the `User` model, add `cnetId` field and transaction relations after the existing fields:

```prisma
// Add after googleId line (line ~19):
  cnetId     String   @unique @map("cnet_id")

// Add after existing relations (after messagesSent line ~30):
  transactionsSold   Transaction[] @relation("TransactionsSold")
  transactionsBought Transaction[] @relation("TransactionsBought")
```

In the `Post` model, add transaction relation after existing relations:

```prisma
// Add after conversations line (~79):
  transaction   Transaction?
```

In the `Review` model, add unique constraint:

```prisma
// Add before @@map("reviews") (line ~217):
  @@unique([postId, reviewerId])
```

Add the Transaction model at the end of the file (before the Conversations section):

```prisma
// ── Transactions ─────────────────────────────

model Transaction {
  id          String   @id @default(uuid())
  postId      String   @map("post_id")
  sellerId    String   @map("seller_id")
  buyerId     String   @map("buyer_id")
  completedAt DateTime @default(now()) @map("completed_at")

  post   Post @relation(fields: [postId], references: [id])
  seller User @relation("TransactionsSold", fields: [sellerId], references: [id])
  buyer  User @relation("TransactionsBought", fields: [buyerId], references: [id])

  @@unique([postId])
  @@index([sellerId])
  @@index([buyerId])
  @@map("transactions")
}
```

- [ ] **Step 2: Update auth service to set cnetId on user creation**

In `apps/api/src/services/auth.service.ts`, modify the user creation block (around line 71):

```typescript
  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.picture || null,
        isVerified: false,
        cnetId: payload.email.split("@")[0],
      },
    });
  }
```

- [ ] **Step 3: Generate migration with cnetId backfill**

Run from `apps/api`:

```bash
cd apps/api && npx prisma migrate dev --name add_transactions_and_cnetid --create-only
```

This creates the migration SQL without applying it. Edit the generated migration file to add the backfill before the NOT NULL constraint. Find the migration file in `apps/api/prisma/migrations/` (most recent folder). The migration will fail if there are existing users without cnetId. Add this SQL **before** the `ALTER TABLE "users" ADD COLUMN "cnet_id"` line, or modify the migration to:

```sql
-- Add cnet_id as nullable first
ALTER TABLE "users" ADD COLUMN "cnet_id" TEXT;

-- Backfill from email
UPDATE "users" SET "cnet_id" = split_part("email", '@', 1) WHERE "cnet_id" IS NULL;

-- Now make it NOT NULL and UNIQUE
ALTER TABLE "users" ALTER COLUMN "cnet_id" SET NOT NULL;
CREATE UNIQUE INDEX "users_cnet_id_key" ON "users"("cnet_id");
```

Then apply:

```bash
npx prisma migrate dev
```

- [ ] **Step 4: Verify migration applied**

```bash
npx prisma db pull --print | grep -A2 "cnet_id\|transactions"
```

Expected: Shows `cnet_id` column in users and `transactions` table definition.

- [ ] **Step 5: Generate Prisma client and verify types**

```bash
npx prisma generate
```

Then verify the Transaction type is available:

```bash
cd ../.. && npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -20
```

Expected: No type errors related to Transaction or cnetId.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git add apps/api/src/services/auth.service.ts
git commit -m "feat: add transactions table, cnetId column, review unique constraint"
```

---

## Task 2: Shared Package — Types, Schemas, API Client Modules

**Files:**
- Modify: `packages/shared/src/types/user.ts`
- Create: `packages/shared/src/types/transaction.ts`
- Modify: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/schemas/transaction.schema.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Create: `packages/shared/src/api-client/users.ts`
- Create: `packages/shared/src/api-client/transactions.ts`
- Create: `packages/shared/src/api-client/reviews.ts`
- Create: `packages/shared/src/api-client/saved.ts`
- Modify: `packages/shared/src/api-client/index.ts`

- [ ] **Step 1: Add transaction types**

Create `packages/shared/src/types/transaction.ts`:

```typescript
export interface Transaction {
  id: string;
  postId: string;
  sellerId: string;
  buyerId: string;
  completedAt: Date;
}

export interface TransactionWithDetails extends Transaction {
  post: { id: string; title: string; type: string };
  buyer: { id: string; name: string; cnetId: string; avatarUrl: string | null };
  seller: { id: string; name: string; cnetId: string; avatarUrl: string | null };
}
```

- [ ] **Step 2: Update user types**

In `packages/shared/src/types/user.ts`, add after the existing `PublicUser` interface:

```typescript
export interface UserSearchResult {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
}

export interface UserProfileStats {
  averageRating: number | null;
  reviewCount: number;
  transactionCount: number;
  activeListingCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
  stats: UserProfileStats;
  activePosts: import("./post").PostWithDetails[];
  reviews: {
    data: import("./review").ReviewWithAuthor[];
    total: number;
  };
}

export interface UserProfilePrivate extends UserProfile {
  email: string;
  phone: string | null;
}
```

Also add `cnetId` to the existing `User` and `PublicUser` interfaces:

```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  cnetId: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  googleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
}
```

- [ ] **Step 3: Export transaction types**

In `packages/shared/src/types/index.ts`, add:

```typescript
export * from "./transaction";
```

- [ ] **Step 4: Create transaction schema**

Create `packages/shared/src/schemas/transaction.schema.ts`:

```typescript
import { z } from "zod";

export const createTransactionSchema = z.object({
  postId: z.string().uuid(),
  buyerId: z.string().uuid(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
```

- [ ] **Step 5: Export transaction schema**

In `packages/shared/src/schemas/index.ts`, add:

```typescript
export * from "./transaction.schema";
```

- [ ] **Step 6: Create users API client module**

Create `packages/shared/src/api-client/users.ts`:

```typescript
import type { UserSearchResult, UserProfile, UserProfilePrivate } from "../types/user";
import type { ApiClient } from "./client";

export function createUsersApi(client: ApiClient) {
  return {
    search(query: string) {
      return client.request<UserSearchResult[]>("/api/users/search", {
        params: { q: query },
      });
    },

    getProfile(userId: string) {
      return client.request<UserProfile>(`/api/users/${userId}`);
    },

    getMyProfile() {
      return client.request<UserProfilePrivate>("/api/users/me/profile");
    },
  };
}
```

- [ ] **Step 7: Create transactions API client module**

Create `packages/shared/src/api-client/transactions.ts`:

```typescript
import type { TransactionWithDetails } from "../types/transaction";
import type { ApiClient } from "./client";

export function createTransactionsApi(client: ApiClient) {
  return {
    create(data: { postId: string; buyerId: string }) {
      return client.request<TransactionWithDetails>("/api/transactions", {
        method: "POST",
        body: data,
      });
    },

    undo(postId: string) {
      return client.request<void>(`/api/transactions/${postId}`, {
        method: "DELETE",
      });
    },
  };
}
```

- [ ] **Step 8: Create reviews API client module**

Create `packages/shared/src/api-client/reviews.ts`:

```typescript
import type { ReviewWithAuthor } from "../types/review";
import type { CreateReviewInput } from "../schemas/review.schema";
import type { ApiClient } from "./client";

export interface ReviewEligibility {
  eligible: boolean;
  revieweeId?: string;
  revieweeName?: string;
  alreadyReviewed: boolean;
}

export function createReviewsApi(client: ApiClient) {
  return {
    create(data: CreateReviewInput) {
      return client.request<ReviewWithAuthor>("/api/reviews", {
        method: "POST",
        body: data,
      });
    },

    getForUser(userId: string, params?: { page?: number; limit?: number }) {
      return client.request<{
        data: ReviewWithAuthor[];
        total: number;
        averageRating: number | null;
      }>(`/api/users/${userId}/reviews`, {
        params: params as Record<string, string | number | boolean | undefined>,
      });
    },

    checkEligibility(postId: string) {
      return client.request<ReviewEligibility>("/api/reviews/eligibility", {
        params: { postId },
      });
    },
  };
}
```

- [ ] **Step 9: Create saved API client module**

Create `packages/shared/src/api-client/saved.ts`:

```typescript
import type { PostWithDetails } from "../types/post";
import type { ApiClient } from "./client";

export function createSavedApi(client: ApiClient) {
  return {
    save(postId: string) {
      return client.request<{ saved: true }>(`/api/saved/${postId}`, {
        method: "POST",
      });
    },

    unsave(postId: string) {
      return client.request<void>(`/api/saved/${postId}`, {
        method: "DELETE",
      });
    },

    list(params?: { page?: number; limit?: number }) {
      return client.request<{ data: PostWithDetails[]; total: number }>(
        "/api/saved",
        { params: params as Record<string, string | number | boolean | undefined> },
      );
    },
  };
}
```

- [ ] **Step 10: Update API client barrel to wire everything together**

Replace `packages/shared/src/api-client/index.ts` with:

```typescript
import { ApiClient } from "./client";
import { createAuthApi } from "./auth";
import { createPostsApi } from "./posts";
import { createUsersApi } from "./users";
import { createTransactionsApi } from "./transactions";
import { createReviewsApi } from "./reviews";
import { createSavedApi } from "./saved";

export { ApiClient, ApiError } from "./client";
export type { ReviewEligibility } from "./reviews";

export function createApi(baseUrl: string, getToken: () => string | null) {
  const client = new ApiClient(baseUrl, getToken);

  return {
    auth: createAuthApi(client),
    posts: createPostsApi(client),
    users: createUsersApi(client),
    transactions: createTransactionsApi(client),
    reviews: createReviewsApi(client),
    saved: createSavedApi(client),
  };
}

export type Api = ReturnType<typeof createApi>;
```

- [ ] **Step 11: Verify shared package compiles**

```bash
cd packages/shared && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 12: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, schemas, and API client for transactions, reviews, saved, users"
```

---

## Task 3: API — User Search Endpoint

**Files:**
- Modify: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Add search endpoint to users route**

In `apps/api/src/routes/users.ts`, add this route **before** the `/:id` route (so `/search` doesn't get matched by the `:id` param):

```typescript
// GET /api/users/search — Search users by name or cnetId
router.get("/search", requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.userId } },
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { cnetId: { startsWith: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        cnetId: true,
        avatarUrl: true,
      },
      take: 10,
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});
```

Make sure this is placed before the existing `router.get("/:id", ...)` route.

Also ensure `requireAuth` and `AuthRequest` are imported at the top of the file (they already are).

- [ ] **Step 2: Reorder routes so /me/* and /search come before /:id**

Verify the route order in `apps/api/src/routes/users.ts` is:

1. `GET /search` (new)
2. `GET /me/profile` (existing)
3. `PATCH /me` (existing)
4. `GET /:id` (existing)

If `/me/profile` is currently after `/:id`, move it before `/:id`.

- [ ] **Step 3: Verify the route works with type checking**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/users.ts
git commit -m "feat: add user search endpoint (GET /api/users/search)"
```

---

## Task 4: API — Transaction Service & Routes

**Files:**
- Create: `apps/api/src/services/transaction.service.ts`
- Create: `apps/api/src/routes/transactions.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create transaction service**

Create `apps/api/src/services/transaction.service.ts`:

```typescript
import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";

export async function createTransaction(userId: string, postId: string, buyerId: string) {
  // Validate post exists and is active
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.status !== "active") throw new HttpError(400, "Post is not active");
  if (post.authorId !== userId) throw new HttpError(403, "Only the post author can complete a transaction");
  if (buyerId === userId) throw new HttpError(400, "Cannot create a transaction with yourself");

  // Validate buyer exists
  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new HttpError(404, "Buyer not found");

  // Determine status based on post type
  const newStatus = post.type === "marketplace" ? "sold" : "completed";

  // Create transaction and update post status atomically
  const transaction = await prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: {
        postId,
        sellerId: userId,
        buyerId,
      },
      include: {
        post: { select: { id: true, title: true, type: true } },
        seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
        buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: { status: newStatus as any },
    });

    return txn;
  });

  return transaction;
}

export async function undoTransaction(userId: string, postId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { postId },
    include: { post: true },
  });

  if (!transaction) throw new HttpError(404, "Transaction not found");
  if (transaction.post.authorId !== userId) throw new HttpError(403, "Only the post author can undo a transaction");

  // Check 24-hour window
  const hoursSinceCompletion =
    (Date.now() - transaction.completedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCompletion > 24) {
    throw new HttpError(400, "Cannot undo transaction after 24 hours");
  }

  // Delete transaction and reactivate post atomically
  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { postId } });
    await tx.post.update({
      where: { id: postId },
      data: { status: "active" },
    });
  });
}

export async function getTransactionByPostId(postId: string) {
  return prisma.transaction.findUnique({
    where: { postId },
    include: {
      post: { select: { id: true, title: true, type: true } },
      seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
    },
  });
}

export async function getUserTransactionCount(userId: string): Promise<number> {
  const [sold, bought] = await Promise.all([
    prisma.transaction.count({ where: { sellerId: userId } }),
    prisma.transaction.count({ where: { buyerId: userId } }),
  ]);
  return sold + bought;
}
```

- [ ] **Step 2: Create transactions route**

Create `apps/api/src/routes/transactions.ts`:

```typescript
import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createTransactionSchema } from "@uchicago-marketplace/shared";
import { createTransaction, undoTransaction } from "../services/transaction.service";

const router = Router();

// POST /api/transactions — Complete a transaction
router.post(
  "/",
  requireAuth,
  validate(createTransactionSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const transaction = await createTransaction(
        req.userId!,
        req.body.postId,
        req.body.buyerId,
      );
      res.status(201).json(transaction);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/transactions/:postId — Undo a transaction (within 24h)
router.delete(
  "/:postId",
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      await undoTransaction(req.userId!, req.params.postId as string);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
```

- [ ] **Step 3: Register transactions route in index.ts**

In `apps/api/src/index.ts`, add the import and route registration:

```typescript
// Add import after existing route imports (line ~11):
import transactionRoutes from "./routes/transactions";

// Add route registration after existing routes (line ~34):
app.use("/api/transactions", transactionRoutes);
```

- [ ] **Step 4: Verify compilation**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/transaction.service.ts apps/api/src/routes/transactions.ts apps/api/src/index.ts
git commit -m "feat: add transaction service and routes (POST/DELETE /api/transactions)"
```

---

## Task 5: API — Review Service & Routes

**Files:**
- Create: `apps/api/src/services/review.service.ts`
- Create: `apps/api/src/routes/reviews.ts`
- Modify: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create review service**

Create `apps/api/src/services/review.service.ts`:

```typescript
import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";

interface CreateReviewInput {
  postId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  text?: string | null;
}

export async function createReview(input: CreateReviewInput) {
  const { postId, reviewerId, revieweeId, rating, text } = input;

  // Check eligibility first
  const eligibility = await isEligibleToReview(reviewerId, postId);
  if (!eligibility.eligible) {
    if (eligibility.alreadyReviewed) {
      throw new HttpError(400, "You have already reviewed this transaction");
    }
    throw new HttpError(403, "You are not eligible to review this transaction");
  }

  // Verify the revieweeId matches the expected counterparty
  if (eligibility.revieweeId !== revieweeId) {
    throw new HttpError(400, "Invalid reviewee for this transaction");
  }

  const review = await prisma.review.create({
    data: {
      postId,
      reviewerId,
      revieweeId,
      rating,
      text: text ?? null,
    },
    include: {
      reviewer: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
  });

  return review;
}

export async function getReviewsForUser(
  userId: string,
  page: number = 1,
  limit: number = 10,
) {
  const skip = (page - 1) * limit;

  const [reviews, total, aggregate] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        reviewer: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    }),
    prisma.review.count({ where: { revieweeId: userId } }),
    prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { rating: true },
    }),
  ]);

  return {
    data: reviews,
    total,
    averageRating: aggregate._avg.rating,
  };
}

export async function isEligibleToReview(
  userId: string,
  postId: string,
): Promise<{
  eligible: boolean;
  revieweeId?: string;
  revieweeName?: string;
  alreadyReviewed: boolean;
}> {
  // Find the transaction for this post
  const transaction = await prisma.transaction.findUnique({
    where: { postId },
    include: {
      seller: { select: { id: true, name: true } },
      buyer: { select: { id: true, name: true } },
    },
  });

  if (!transaction) {
    return { eligible: false, alreadyReviewed: false };
  }

  // Determine if user is a party and who they'd review
  let revieweeId: string | undefined;
  let revieweeName: string | undefined;

  if (transaction.sellerId === userId) {
    revieweeId = transaction.buyerId;
    revieweeName = transaction.buyer.name;
  } else if (transaction.buyerId === userId) {
    revieweeId = transaction.sellerId;
    revieweeName = transaction.seller.name;
  } else {
    return { eligible: false, alreadyReviewed: false };
  }

  // Check if already reviewed
  const existingReview = await prisma.review.findUnique({
    where: {
      postId_reviewerId: { postId, reviewerId: userId },
    },
  });

  if (existingReview) {
    return { eligible: false, revieweeId, revieweeName, alreadyReviewed: true };
  }

  return { eligible: true, revieweeId, revieweeName, alreadyReviewed: false };
}
```

- [ ] **Step 2: Create reviews route**

Create `apps/api/src/routes/reviews.ts`:

```typescript
import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createReviewSchema } from "@uchicago-marketplace/shared";
import { createReview, isEligibleToReview } from "../services/review.service";

const router = Router();

// POST /api/reviews — Create a review
router.post(
  "/",
  requireAuth,
  validate(createReviewSchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const review = await createReview({
        ...req.body,
        reviewerId: req.userId!,
      });
      res.status(201).json(review);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/reviews/eligibility?postId=xxx — Check review eligibility
router.get(
  "/eligibility",
  requireAuth,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const postId = req.query.postId as string;
      if (!postId) {
        res.status(400).json({ message: "postId query parameter is required" });
        return;
      }
      const result = await isEligibleToReview(req.userId!, postId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
```

- [ ] **Step 3: Add reviews-for-user endpoint in users route**

In `apps/api/src/routes/users.ts`, add this route. It should go between the `PATCH /me` and `GET /:id` routes:

```typescript
// Add import at top of file:
import { getReviewsForUser } from "../services/review.service";

// Add route before GET /:id:

// GET /api/users/:id/reviews — Reviews received by a user
router.get("/:id/reviews", async (req, res: Response, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await getReviewsForUser(req.params.id as string, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 4: Register reviews route in index.ts**

In `apps/api/src/index.ts`:

```typescript
// Add import:
import reviewRoutes from "./routes/reviews";

// Add route registration:
app.use("/api/reviews", reviewRoutes);
```

- [ ] **Step 5: Verify compilation**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/review.service.ts apps/api/src/routes/reviews.ts apps/api/src/routes/users.ts apps/api/src/index.ts
git commit -m "feat: add review service and routes (transaction-gated reviews)"
```

---

## Task 6: API — Saved Posts Service & Routes

**Files:**
- Create: `apps/api/src/services/saved.service.ts`
- Create: `apps/api/src/routes/saved.ts`
- Modify: `apps/api/src/services/posts.service.ts`
- Modify: `apps/api/src/routes/posts.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create saved service**

Create `apps/api/src/services/saved.service.ts`:

```typescript
import { prisma } from "../config/database";

export async function savePost(userId: string, postId: string) {
  await prisma.savedPost.upsert({
    where: { userId_postId: { userId, postId } },
    update: {},
    create: { userId, postId },
  });
}

export async function unsavePost(userId: string, postId: string) {
  await prisma.savedPost.deleteMany({
    where: { userId, postId },
  });
}

export async function getSavedPosts(
  userId: string,
  page: number = 1,
  limit: number = 20,
) {
  const skip = (page - 1) * limit;

  const [savedPosts, total] = await Promise.all([
    prisma.savedPost.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        post: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
            marketplace: true,
            storage: true,
            housing: true,
            images: { orderBy: { order: "asc" }, take: 1 },
          },
        },
      },
    }),
    prisma.savedPost.count({ where: { userId } }),
  ]);

  return {
    data: savedPosts.map((sp) => sp.post),
    total,
  };
}

export async function getSavedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const saved = await prisma.savedPost.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });

  return new Set(saved.map((s) => s.postId));
}
```

- [ ] **Step 2: Create saved route**

Create `apps/api/src/routes/saved.ts`:

```typescript
import { Router } from "express";
import type { Response, NextFunction } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { savePost, unsavePost, getSavedPosts } from "../services/saved.service";

const router = Router();

// GET /api/saved — List saved posts
router.get("/", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getSavedPosts(req.userId!, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/saved/:postId — Save a post
router.post("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await savePost(req.userId!, req.params.postId as string);
    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/saved/:postId — Unsave a post
router.delete("/:postId", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await unsavePost(req.userId!, req.params.postId as string);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 3: Add isSaved enrichment to posts service**

In `apps/api/src/services/posts.service.ts`, modify the `listPosts` function signature and implementation.

Update the `ListPostsInput` interface (around line 129) to add `userId`:

```typescript
interface ListPostsInput {
  type?: string;
  side?: string;
  q?: string;
  category?: string;
  size?: string;
  locationType?: string;
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  subtype?: string;
  bedrooms?: number;
  bathrooms?: number;
  sort?: string;
  page?: number;
  limit?: number;
  userId?: string;  // for isSaved enrichment
}
```

Then at the end of the `listPosts` function (around line 243), after the `Promise.all`, add isSaved enrichment before the return:

```typescript
  // Enrich with isSaved if user is logged in
  let postsWithSaved = posts;
  if (input.userId) {
    const { getSavedPostIds } = await import("./saved.service");
    const savedIds = await getSavedPostIds(input.userId, posts.map((p) => p.id));
    postsWithSaved = posts.map((p) => ({ ...p, isSaved: savedIds.has(p.id) }));
  }

  return {
    posts: postsWithSaved,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
```

Also update the `getPostById` function to accept an optional userId and add isSaved:

```typescript
export async function getPostById(postId: string, userId?: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
      marketplace: true,
      storage: true,
      housing: true,
      images: { orderBy: { order: "asc" } },
      _count: { select: { savedBy: true } },
    },
  });

  if (!post) throw new HttpError(404, "Post not found");
  if (post.status === "deleted") throw new HttpError(404, "Post not found");

  if (userId) {
    const { getSavedPostIds } = await import("./saved.service");
    const savedIds = await getSavedPostIds(userId, [postId]);
    return { ...post, isSaved: savedIds.has(postId) };
  }

  return { ...post, isSaved: false };
}
```

- [ ] **Step 4: Pass userId in posts route**

In `apps/api/src/routes/posts.ts`, update the list and detail handlers to pass userId:

For the `GET /` handler (around line 34):

```typescript
router.get("/", optionalAuth, validate(postQuerySchema, "query"), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await listPosts({ ...req.query as any, userId: req.userId });
    res.json(result);
  } catch (err) { next(err); }
});
```

For the `GET /:id` handler (around line 42):

```typescript
router.get("/:id", optionalAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const post = await getPostById(param(req, "id"), req.userId);
    res.json(post);
  } catch (err) { next(err); }
});
```

- [ ] **Step 5: Register saved route in index.ts**

In `apps/api/src/index.ts`:

```typescript
// Add import:
import savedRoutes from "./routes/saved";

// Add route registration:
app.use("/api/saved", savedRoutes);
```

- [ ] **Step 6: Verify compilation**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/saved.service.ts apps/api/src/routes/saved.ts apps/api/src/services/posts.service.ts apps/api/src/routes/posts.ts apps/api/src/index.ts
git commit -m "feat: add saved posts service/routes with isSaved enrichment on post listings"
```

---

## Task 7: API — Profile Aggregation

**Files:**
- Modify: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Enrich GET /api/users/:id with profile data**

In `apps/api/src/routes/users.ts`, add imports at top:

```typescript
import { getUserTransactionCount } from "../services/transaction.service";
```

Then replace the existing `GET /:id` handler with:

```typescript
// GET /api/users/:id — Enriched public profile
router.get("/:id", async (req, res: Response, next) => {
  try {
    const userId = req.params.id as string;

    const [user, reviewData, transactionCount, activeListingCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          cnetId: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
        },
      }),
      getReviewsForUser(userId, 1, 10),
      getUserTransactionCount(userId),
      prisma.post.count({
        where: { authorId: userId, status: "active" },
      }),
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Fetch active posts separately (not in parallel — we need to confirm user exists first)
    const activePosts = await prisma.post.findMany({
      where: { authorId: userId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        marketplace: true,
        storage: true,
        housing: true,
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    });

    res.json({
      ...user,
      stats: {
        averageRating: reviewData.averageRating,
        reviewCount: reviewData.total,
        transactionCount,
        activeListingCount,
      },
      activePosts,
      reviews: {
        data: reviewData.data,
        total: reviewData.total,
      },
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 2: Enrich GET /api/users/me/profile**

Replace the existing `GET /me/profile` handler:

```typescript
// GET /api/users/me/profile — Current user's full profile
router.get("/me/profile", requireAuth, async (req: AuthRequest, res: Response, next) => {
  try {
    const userId = req.userId!;

    const [user, reviewData, transactionCount, activeListingCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          cnetId: true,
          phone: true,
          avatarUrl: true,
          isVerified: true,
          createdAt: true,
        },
      }),
      getReviewsForUser(userId, 1, 10),
      getUserTransactionCount(userId),
      prisma.post.count({
        where: { authorId: userId, status: "active" },
      }),
    ]);

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const activePosts = await prisma.post.findMany({
      where: { authorId: userId, status: "active" },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        marketplace: true,
        storage: true,
        housing: true,
        images: { orderBy: { order: "asc" }, take: 1 },
      },
    });

    res.json({
      ...user,
      stats: {
        averageRating: reviewData.averageRating,
        reviewCount: reviewData.total,
        transactionCount,
        activeListingCount,
      },
      activePosts,
      reviews: {
        data: reviewData.data,
        total: reviewData.total,
      },
    });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Verify compilation**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/users.ts
git commit -m "feat: enrich user profile endpoints with stats, posts, and reviews"
```

---

## Task 8: Web — Profile Page

**Files:**
- Create: `apps/web/src/app/profile/[id]/page.tsx`

- [ ] **Step 1: Create profile page**

Create `apps/web/src/app/profile/[id]/page.tsx`:

```tsx
"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ── Types ──

interface ProfileStats {
  averageRating: number | null;
  reviewCount: number;
  transactionCount: number;
  activeListingCount: number;
}

interface ProfilePost {
  id: string;
  title: string;
  type: string;
  side: string;
  createdAt: string;
  marketplace: { priceType: string; priceAmount: number | null; category: string } | null;
  storage: { size: string; priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null; subtype: string } | null;
  images: { url: string }[];
}

interface ProfileReview {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; avatarUrl: string | null };
}

interface UserProfileData {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: string;
  stats: ProfileStats;
  activePosts: ProfilePost[];
  reviews: { data: ProfileReview[]; total: number };
}

// ── Star Rating Display ──

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={star <= Math.round(rating) ? "text-amber-400" : "text-gray-300"}
        >
          &#9733;
        </span>
      ))}
    </span>
  );
}

// ── Post Card (reused pattern from browse) ──

function PostCard({ post }: { post: ProfilePost }) {
  const price =
    post.marketplace?.priceType === "free"
      ? "Free"
      : post.marketplace?.priceAmount
        ? `$${post.marketplace.priceAmount}`
        : post.storage?.isFree
          ? "Free"
          : post.storage?.priceMonthly
            ? `$${post.storage.priceMonthly}/mo`
            : post.housing?.monthlyRent
              ? `$${post.housing.monthlyRent}/mo`
              : "";

  return (
    <Link
      href={`/posts/${post.id}`}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden"
    >
      {post.images[0] && (
        <div className="aspect-[4/3] bg-gray-100">
          <img src={post.images[0].url} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <p className="font-semibold text-gray-900 text-sm truncate">{post.title}</p>
        {price && <p className="text-maroon-600 font-bold text-sm mt-1">{price}</p>}
        <p className="text-xs text-gray-400 mt-1 capitalize">{post.type}</p>
      </div>
    </Link>
  );
}

// ── Review Card ──

function ReviewCard({ review }: { review: ProfileReview }) {
  const date = new Date(review.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {review.reviewer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{review.reviewer.name}</p>
          <p className="text-xs text-gray-400">{date}</p>
        </div>
        <div className="ml-auto">
          <StarRating rating={review.rating} />
        </div>
      </div>
      {review.text && <p className="text-sm text-gray-600 mt-2">{review.text}</p>}
    </div>
  );
}

// ── Main Profile Page ──

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, accessToken } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"listings" | "reviews">("listings");
  const [allReviews, setAllReviews] = useState<ProfileReview[]>([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/users/${id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      setProfile(data);
      setAllReviews(data.reviews.data);
      setHasMoreReviews(data.reviews.data.length < data.reviews.total);
    } catch {
      setError("Could not load profile");
    } finally {
      setIsLoading(false);
    }
  }, [id, accessToken]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function loadMoreReviews() {
    const nextPage = reviewsPage + 1;
    try {
      const res = await fetch(`${API_URL}/api/users/${id}/reviews?page=${nextPage}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      setAllReviews((prev) => [...prev, ...data.data]);
      setReviewsPage(nextPage);
      setHasMoreReviews(allReviews.length + data.data.length < data.total);
    } catch {
      // Ignore load-more failures
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">{error || "Profile not found"}</p>
          <button onClick={() => router.back()} className="mt-4 text-maroon-600 font-medium">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-xl sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/browse" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-2 sm:px-3 py-1.5 rounded-md transition-colors">
            Browse
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-2xl font-bold">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)
            )}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{profile.name}</h1>
          <p className="text-sm text-gray-500 mt-1">@{profile.cnetId}</p>
          {profile.isVerified && (
            <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              &#10003; Verified
            </span>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
            <div>
              <div className="flex items-center justify-center gap-1">
                {profile.stats.averageRating ? (
                  <>
                    <StarRating rating={profile.stats.averageRating} />
                    <span className="text-sm font-bold text-gray-900">{profile.stats.averageRating.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-sm text-gray-400">No ratings</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">Rating</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{profile.stats.reviewCount}</p>
              <p className="text-xs text-gray-500">Reviews</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{profile.stats.transactionCount}</p>
              <p className="text-xs text-gray-500">Transactions</p>
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{profile.stats.activeListingCount}</p>
              <p className="text-xs text-gray-500">Listings</p>
            </div>
          </div>

          {isOwnProfile && (
            <Link
              href="/profile/edit"
              className="inline-block mt-4 text-sm font-medium text-maroon-600 hover:underline"
            >
              Edit Profile
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setActiveTab("listings")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "listings" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            Listings ({profile.stats.activeListingCount})
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === "reviews" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            Reviews ({profile.stats.reviewCount})
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "listings" ? (
          profile.activePosts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {profile.activePosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>No active listings</p>
            </div>
          )
        ) : allReviews.length > 0 ? (
          <div className="space-y-4">
            {allReviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            {hasMoreReviews && (
              <button
                onClick={loadMoreReviews}
                className="w-full py-3 text-sm font-medium text-maroon-600 hover:bg-maroon-50 rounded-lg transition-colors"
              >
                Load more reviews
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>No reviews yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify page compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/profile/
git commit -m "feat: add web profile page with stats, listings, and reviews"
```

---

## Task 9: Web — Saved Posts Page + Save Button + Navbar Link

**Files:**
- Create: `apps/web/src/app/saved/page.tsx`
- Modify: `apps/web/src/app/page.tsx` (navbar)
- Modify: `apps/web/src/app/browse/page.tsx` (save button on cards)
- Modify: `apps/web/src/app/posts/[id]/page.tsx` (save button)

- [ ] **Step 1: Create saved posts page**

Create `apps/web/src/app/saved/page.tsx`:

```tsx
"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface SavedPost {
  id: string;
  title: string;
  type: string;
  side: string;
  createdAt: string;
  author: { name: string };
  marketplace: { priceType: string; priceAmount: number | null; category: string } | null;
  storage: { size: string; priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null; subtype: string } | null;
  images: { url: string }[];
}

export default function SavedPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSaved = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/saved`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.data || []);
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }
    fetchSaved();
  }, [authLoading, user, fetchSaved, router]);

  async function handleUnsave(postId: string) {
    if (!accessToken) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await fetch(`${API_URL}/api/saved/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      fetchSaved(); // rollback on failure
    }
  }

  function getPrice(post: SavedPost): string {
    if (post.marketplace?.priceType === "free") return "Free";
    if (post.marketplace?.priceAmount) return `$${post.marketplace.priceAmount}`;
    if (post.storage?.isFree) return "Free";
    if (post.storage?.priceMonthly) return `$${post.storage.priceMonthly}/mo`;
    if (post.housing?.monthlyRent) return `$${post.housing.monthlyRent}/mo`;
    return "";
  }

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="text-xl sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
          UChicago
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/browse" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
            Browse
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Saved Posts</h1>

        {posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-gray-400 mb-2">No saved posts yet</p>
            <p className="text-sm text-gray-400 mb-4">Browse listings and tap the heart to save them here</p>
            <Link href="/browse" className="text-maroon-600 font-medium hover:underline">
              Browse listings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {posts.map((post) => (
              <div key={post.id} className="relative bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow overflow-hidden">
                <button
                  onClick={() => handleUnsave(post.id)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-red-500 hover:bg-white transition-colors"
                  aria-label="Unsave"
                >
                  &#9829;
                </button>
                <Link href={`/posts/${post.id}`}>
                  {post.images[0] && (
                    <div className="aspect-[4/3] bg-gray-100">
                      <img src={post.images[0].url} alt={post.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-semibold text-gray-900 text-sm truncate">{post.title}</p>
                    {getPrice(post) && (
                      <p className="text-maroon-600 font-bold text-sm mt-1">{getPrice(post)}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1 capitalize">{post.type}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add "Saved" link to navbar on home page**

In `apps/web/src/app/page.tsx`, find the navbar section where the authenticated user links are (around line 54-67). Add a "Saved" link after the "+ Post" link:

```tsx
              <Link href="/saved" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                Saved
              </Link>
```

Also update the profile link to use the user's ID:

```tsx
              <Link href={`/profile/${user.id}`} className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </Link>
```

- [ ] **Step 3: Verify pages compile**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/saved/ apps/web/src/app/page.tsx
git commit -m "feat: add saved posts page, navbar saved link, profile link"
```

---

## Task 10: Web — Post Detail Enhancements (Save, Mark Sold, Review)

**Files:**
- Modify: `apps/web/src/app/posts/[id]/page.tsx`

This is the largest UI task. We need to add three features to the existing post detail page:
1. Save/unsave toggle
2. "Mark as Sold/Completed" button with user search modal
3. "Leave a Review" button with review form

- [ ] **Step 1: Add save button, mark-sold modal, and review form to post detail**

In `apps/web/src/app/posts/[id]/page.tsx`, add these state variables and handlers inside the main component function (after existing state declarations). The specific insertions depend on the current structure of the file, but the additions needed are:

**New state variables** (add near other useState declarations):

```tsx
  const [isSaved, setIsSaved] = useState(false);
  const [showMarkSold, setShowMarkSold] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; cnetId: string; avatarUrl: string | null }>>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string; cnetId: string } | null>(null);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState<{ eligible: boolean; revieweeId?: string; revieweeName?: string; alreadyReviewed: boolean } | null>(null);
  const [transactionInfo, setTransactionInfo] = useState<{ completedAt: string; buyerId: string; sellerId: string } | null>(null);
```

**Fetch isSaved from post data** — after fetching the post, set `isSaved` from the response:

```tsx
  // In the existing fetchPost effect or callback, after setting post data:
  setIsSaved(data.isSaved || false);
```

**Check review eligibility** — add a useEffect that runs after the post is loaded:

```tsx
  useEffect(() => {
    if (!post || !accessToken) return;
    if (post.status !== "sold" && post.status !== "completed") return;

    fetch(`${API_URL}/api/reviews/eligibility?postId=${post.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setReviewEligibility(data); })
      .catch(() => {});
  }, [post?.id, post?.status, accessToken]);
```

**Save toggle handler:**

```tsx
  async function handleToggleSave() {
    if (!accessToken) {
      router.push("/auth");
      return;
    }
    const wasSaved = isSaved;
    setIsSaved(!wasSaved);
    try {
      await fetch(`${API_URL}/api/saved/${post!.id}`, {
        method: wasSaved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      setIsSaved(wasSaved); // rollback
    }
  }
```

**User search handler:**

```tsx
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, accessToken]);
```

**Mark sold handler:**

```tsx
  async function handleMarkSold() {
    if (!selectedBuyer || !post || !accessToken) return;
    setIsSubmittingTransaction(true);
    try {
      await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ postId: post.id, buyerId: selectedBuyer.id }),
      });
      // Refresh the post
      window.location.reload();
    } catch {
      alert("Failed to complete transaction");
    } finally {
      setIsSubmittingTransaction(false);
    }
  }
```

**Review submit handler:**

```tsx
  async function handleSubmitReview() {
    if (!reviewEligibility?.revieweeId || !post || !accessToken || reviewRating === 0) return;
    setIsSubmittingReview(true);
    try {
      await fetch(`${API_URL}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId: post.id,
          revieweeId: reviewEligibility.revieweeId,
          rating: reviewRating,
          text: reviewText || null,
        }),
      });
      setShowReviewForm(false);
      setReviewEligibility((prev) => prev ? { ...prev, eligible: false, alreadyReviewed: true } : null);
    } catch {
      alert("Failed to submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  }
```

**UI additions** — add these in the JSX of the post detail page, in appropriate locations:

**Save button** (add near the title/header area):

```tsx
        <button
          onClick={handleToggleSave}
          className={`p-2 rounded-full transition-colors ${isSaved ? "text-red-500" : "text-gray-400 hover:text-red-400"}`}
          aria-label={isSaved ? "Unsave" : "Save"}
        >
          <span className="text-xl">{isSaved ? "♥" : "♡"}</span>
        </button>
```

**Mark as Sold/Completed button** (add after the post info section, visible only to post author when active):

```tsx
        {post.status === "active" && user?.id === post.author.id && (
          <button
            onClick={() => setShowMarkSold(true)}
            className="w-full mt-4 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
          >
            Mark as {post.type === "marketplace" ? "Sold" : "Completed"}
          </button>
        )}
```

**Sold/Completed status badge** (show when post is sold/completed):

```tsx
        {(post.status === "sold" || post.status === "completed") && (
          <div className="mt-4 p-3 bg-gray-100 rounded-xl text-center">
            <p className="text-sm font-medium text-gray-600">
              This post has been {post.status === "sold" ? "sold" : "completed"}
            </p>
          </div>
        )}
```

**Review button** (visible when eligible):

```tsx
        {reviewEligibility?.eligible && !reviewEligibility.alreadyReviewed && (
          <button
            onClick={() => setShowReviewForm(true)}
            className="w-full mt-4 py-3 bg-maroon-600 text-white font-semibold rounded-xl hover:bg-maroon-700 transition-colors"
          >
            Leave a Review for {reviewEligibility.revieweeName}
          </button>
        )}
        {reviewEligibility?.alreadyReviewed && (
          <p className="mt-4 text-sm text-gray-500 text-center">You have already reviewed this transaction</p>
        )}
```

**Mark Sold Modal** (add before closing of main container):

```tsx
        {showMarkSold && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMarkSold(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Mark as {post.type === "marketplace" ? "Sold" : "Completed"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">Search for the buyer/counterparty by name or CNet ID</p>
              <input
                type="text"
                placeholder="Search by name or CNet ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedBuyer(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-transparent outline-none"
              />
              {searchResults.length > 0 && !selectedBuyer && (
                <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedBuyer(u); setSearchResults([]); }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500">@{u.cnetId}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedBuyer && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-800">
                    {selectedBuyer.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedBuyer.name}</p>
                    <p className="text-xs text-gray-500">@{selectedBuyer.cnetId}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowMarkSold(false); setSearchQuery(""); setSelectedBuyer(null); }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkSold}
                  disabled={!selectedBuyer || isSubmittingTransaction}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingTransaction ? "Completing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
```

**Review Form Modal** (add before closing of main container):

```tsx
        {showReviewForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReviewForm(false)}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Review {reviewEligibility?.revieweeName}
              </h3>
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className={`text-3xl transition-colors ${star <= reviewRating ? "text-amber-400" : "text-gray-300"} hover:text-amber-300`}
                  >
                    &#9733;
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Write a review (optional)..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value.slice(0, 500))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-maroon-500 focus:border-transparent outline-none resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">{reviewText.length}/500</p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => { setShowReviewForm(false); setReviewRating(0); setReviewText(""); }}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={reviewRating === 0 || isSubmittingReview}
                  className="flex-1 py-2 bg-maroon-600 text-white rounded-lg text-sm font-medium hover:bg-maroon-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingReview ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </div>
          </div>
        )}
```

- [ ] **Step 2: Verify page compiles**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/posts/
git commit -m "feat: add save, mark-sold, and review features to web post detail"
```

---

## Task 11: Mobile — Hooks (useProfile, useSavedPosts, useTransaction, useReview)

**Files:**
- Create: `apps/mobile/hooks/useProfile.ts`
- Create: `apps/mobile/hooks/useSavedPosts.ts`
- Create: `apps/mobile/hooks/useTransaction.ts`
- Create: `apps/mobile/hooks/useReview.ts`

- [ ] **Step 1: Create useProfile hook**

Create `apps/mobile/hooks/useProfile.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { UserProfile } from "@uchicago-marketplace/shared";

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.users.getProfile(userId);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refresh: fetchProfile };
}
```

- [ ] **Step 2: Create useSavedPosts hook**

Create `apps/mobile/hooks/useSavedPosts.ts`:

```typescript
import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export function useSavedPosts() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const isSaved = useCallback((postId: string) => savedIds.has(postId), [savedIds]);

  const toggleSave = useCallback(async (postId: string) => {
    const wasSaved = savedIds.has(postId);

    // Optimistic update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });

    try {
      if (wasSaved) {
        await api.saved.unsave(postId);
      } else {
        await api.saved.save(postId);
      }
    } catch {
      // Rollback
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) {
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
    }
  }, [savedIds]);

  const initSavedState = useCallback((postId: string, saved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) {
        next.add(postId);
      } else {
        next.delete(postId);
      }
      return next;
    });
  }, []);

  return { isSaved, toggleSave, initSavedState };
}
```

- [ ] **Step 3: Create useTransaction hook**

Create `apps/mobile/hooks/useTransaction.ts`:

```typescript
import { useState } from "react";
import { api } from "@/lib/api";
import type { TransactionWithDetails } from "@uchicago-marketplace/shared";

export function useTransaction() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTransaction(
    postId: string,
    buyerId: string,
  ): Promise<TransactionWithDetails | null> {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.transactions.create({ postId, buyerId });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete transaction";
      setError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function undoTransaction(postId: string): Promise<boolean> {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.transactions.undo(postId);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to undo transaction";
      setError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createTransaction, undoTransaction, isSubmitting, error };
}
```

- [ ] **Step 4: Create useReview hook**

Create `apps/mobile/hooks/useReview.ts`:

```typescript
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ReviewEligibility } from "@uchicago-marketplace/shared";

export function useReview(postId: string | undefined, postStatus: string | undefined) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || (postStatus !== "sold" && postStatus !== "completed")) return;

    api.reviews
      .checkEligibility(postId)
      .then(setEligibility)
      .catch(() => {});
  }, [postId, postStatus]);

  async function submitReview(data: {
    postId: string;
    revieweeId: string;
    rating: number;
    text?: string | null;
  }): Promise<boolean> {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.reviews.create(data);
      setEligibility((prev) =>
        prev ? { ...prev, eligible: false, alreadyReviewed: true } : null,
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit review";
      setError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { eligibility, submitReview, isSubmitting, error };
}
```

- [ ] **Step 5: Verify hooks compile**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing warnings).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/hooks/useProfile.ts apps/mobile/hooks/useSavedPosts.ts apps/mobile/hooks/useTransaction.ts apps/mobile/hooks/useReview.ts
git commit -m "feat: add mobile hooks for profile, saved posts, transactions, reviews"
```

---

## Task 12: Mobile — Profile Screen

**Files:**
- Create: `apps/mobile/app/profile/[id].tsx`
- Create: `apps/mobile/app/saved.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Create profile screen**

Create `apps/mobile/app/profile/[id].tsx`:

```tsx
import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

type TabType = "listings" | "reviews";

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <FontAwesome
          key={star}
          name={star <= Math.round(rating) ? "star" : "star-o"}
          size={size}
          color={star <= Math.round(rating) ? colors.star : colors.gray[300]}
        />
      ))}
    </View>
  );
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const { profile, isLoading, error, refresh } = useProfile(id);
  const [activeTab, setActiveTab] = useState<TabType>("listings");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.maroon[600]} />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error || "Profile not found"}</Text>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.maroon[600]} />}
    >
      {/* Header */}
      <Pressable onPress={() => router.back()} style={styles.backNav}>
        <FontAwesome name="chevron-left" size={16} color={colors.gray[600]} />
        <Text style={styles.backNavText}>Back</Text>
      </Pressable>

      {/* Profile Header */}
      <View style={styles.profileHeader}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <FontAwesome name="user" size={32} color={colors.gray[300]} />
          </View>
        )}
        <Text style={styles.name}>{profile.name}</Text>
        <Text style={styles.cnetId}>@{profile.cnetId}</Text>
        {profile.isVerified && (
          <View style={styles.verifiedBadge}>
            <FontAwesome name="check-circle" size={12} color={colors.success} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
        <Text style={styles.memberSince}>
          Member since {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          {profile.stats.averageRating ? (
            <View style={{ alignItems: "center" }}>
              <StarRating rating={profile.stats.averageRating} />
              <Text style={styles.statValue}>{profile.stats.averageRating.toFixed(1)}</Text>
            </View>
          ) : (
            <Text style={styles.statEmpty}>--</Text>
          )}
          <Text style={styles.statLabel}>Rating</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.stats.reviewCount}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.stats.transactionCount}</Text>
          <Text style={styles.statLabel}>Deals</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.stats.activeListingCount}</Text>
          <Text style={styles.statLabel}>Listings</Text>
        </View>
      </View>

      {/* My Saved (own profile only) */}
      {isOwnProfile && (
        <Pressable style={styles.savedRow} onPress={() => router.push("/saved")}>
          <FontAwesome name="heart" size={16} color={colors.maroon[600]} />
          <Text style={styles.savedRowText}>My Saved Posts</Text>
          <FontAwesome name="chevron-right" size={14} color={colors.gray[400]} />
        </Pressable>
      )}

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tab, activeTab === "listings" && styles.tabActive]}
          onPress={() => setActiveTab("listings")}
        >
          <Text style={[styles.tabText, activeTab === "listings" && styles.tabTextActive]}>
            Listings ({profile.stats.activeListingCount})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "reviews" && styles.tabActive]}
          onPress={() => setActiveTab("reviews")}
        >
          <Text style={[styles.tabText, activeTab === "reviews" && styles.tabTextActive]}>
            Reviews ({profile.stats.reviewCount})
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      {activeTab === "listings" ? (
        profile.activePosts.length > 0 ? (
          <View style={styles.postsList}>
            {profile.activePosts.map((post: any) => (
              <Pressable
                key={post.id}
                style={styles.postCard}
                onPress={() => router.push(`/posts/${post.id}`)}
              >
                {post.images?.[0] && (
                  <Image source={{ uri: post.images[0].url }} style={styles.postImage} />
                )}
                <View style={styles.postInfo}>
                  <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                  <Text style={styles.postType}>{post.type}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active listings</Text>
          </View>
        )
      ) : profile.reviews.data.length > 0 ? (
        <View style={styles.reviewsList}>
          {profile.reviews.data.map((review: any) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>{review.reviewer.name}</Text>
                <StarRating rating={review.rating} size={12} />
              </View>
              {review.text && <Text style={styles.reviewText}>{review.text}</Text>}
              <Text style={styles.reviewDate}>
                {new Date(review.createdAt).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No reviews yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  errorText: { fontSize: 14, color: colors.gray[500] },
  backButton: { marginTop: 16 },
  backButtonText: { fontSize: 14, fontWeight: "600", color: colors.maroon[600] },
  backNav: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  backNavText: { fontSize: 14, color: colors.gray[600] },

  profileHeader: { alignItems: "center", paddingHorizontal: 24, marginBottom: 24 },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 12 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray[100], alignItems: "center", justifyContent: "center", marginBottom: 12 },
  name: { fontSize: 20, fontWeight: "700", color: colors.gray[900] },
  cnetId: { fontSize: 14, color: colors.gray[500], marginTop: 2 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, backgroundColor: "#f0f7f0", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  verifiedText: { fontSize: 11, fontWeight: "600", color: colors.success },
  memberSince: { fontSize: 12, color: colors.gray[400], marginTop: 8 },

  statsRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 20, gap: 8 },
  statItem: { flex: 1, alignItems: "center", backgroundColor: colors.gray[50], borderRadius: 12, paddingVertical: 12 },
  statValue: { fontSize: 18, fontWeight: "700", color: colors.gray[900] },
  statEmpty: { fontSize: 18, fontWeight: "700", color: colors.gray[300] },
  statLabel: { fontSize: 11, color: colors.gray[500], marginTop: 2 },

  savedRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 20, backgroundColor: colors.gray[50], borderRadius: 12, padding: 14, gap: 10 },
  savedRowText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.gray[900] },

  tabContainer: { flexDirection: "row", marginHorizontal: 16, backgroundColor: colors.gray[100], borderRadius: 10, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: colors.white, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.gray[500] },
  tabTextActive: { color: colors.gray[900] },

  postsList: { paddingHorizontal: 16, gap: 12 },
  postCard: { flexDirection: "row", backgroundColor: colors.gray[50], borderRadius: 12, overflow: "hidden" },
  postImage: { width: 80, height: 80 },
  postInfo: { flex: 1, padding: 12, justifyContent: "center" },
  postTitle: { fontSize: 14, fontWeight: "600", color: colors.gray[900] },
  postType: { fontSize: 12, color: colors.gray[500], marginTop: 4, textTransform: "capitalize" },

  reviewsList: { paddingHorizontal: 16, gap: 12 },
  reviewCard: { backgroundColor: colors.gray[50], borderRadius: 12, padding: 14 },
  reviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reviewerName: { fontSize: 14, fontWeight: "600", color: colors.gray[900] },
  reviewText: { fontSize: 13, color: colors.gray[600], lineHeight: 18 },
  reviewDate: { fontSize: 11, color: colors.gray[400], marginTop: 8 },

  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyText: { fontSize: 14, color: colors.gray[400] },
});
```

- [ ] **Step 2: Create saved posts screen**

Create `apps/mobile/app/saved.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";
import { api } from "@/lib/api";

interface SavedPostItem {
  id: string;
  title: string;
  type: string;
  marketplace: { priceAmount: number | null; priceType: string } | null;
  storage: { priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null } | null;
  images: { url: string }[];
}

export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<SavedPostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSaved = useCallback(async () => {
    try {
      const data = await api.saved.list();
      setPosts(data.data as any[]);
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchSaved();
    setIsRefreshing(false);
  }, [fetchSaved]);

  function getPrice(post: SavedPostItem): string {
    if (post.marketplace?.priceType === "free") return "Free";
    if (post.marketplace?.priceAmount) return `$${post.marketplace.priceAmount}`;
    if (post.storage?.isFree) return "Free";
    if (post.storage?.priceMonthly) return `$${post.storage.priceMonthly}/mo`;
    if (post.housing?.monthlyRent) return `$${post.housing.monthlyRent}/mo`;
    return "";
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.maroon[600]} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="chevron-left" size={16} color={colors.gray[600]} />
        </Pressable>
        <Text style={styles.headerTitle}>Saved Posts</Text>
        <View style={{ width: 32 }} />
      </View>

      {posts.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="heart-o" size={40} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No saved posts yet</Text>
          <Text style={styles.emptySubtitle}>Browse listings and tap the heart to save them</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.maroon[600]} />}
          renderItem={({ item }) => (
            <Pressable style={styles.postCard} onPress={() => router.push(`/posts/${item.id}`)}>
              {item.images?.[0] && (
                <Image source={{ uri: item.images[0].url }} style={styles.postImage} />
              )}
              <View style={styles.postInfo}>
                <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
                {getPrice(item) ? <Text style={styles.postPrice}>{getPrice(item)}</Text> : null}
                <Text style={styles.postType}>{item.type}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.gray[900] },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.gray[500] },
  emptySubtitle: { fontSize: 13, color: colors.gray[400] },
  postCard: { flexDirection: "row", backgroundColor: colors.gray[50], borderRadius: 12, overflow: "hidden" },
  postImage: { width: 80, height: 80 },
  postInfo: { flex: 1, padding: 12, justifyContent: "center" },
  postTitle: { fontSize: 14, fontWeight: "600", color: colors.gray[900] },
  postPrice: { fontSize: 14, fontWeight: "700", color: colors.maroon[600], marginTop: 4 },
  postType: { fontSize: 12, color: colors.gray[500], marginTop: 4, textTransform: "capitalize" },
});
```

- [ ] **Step 3: Update profile tab to navigate to profile/[id]**

In `apps/mobile/app/(tabs)/profile.tsx`, update the `AuthenticatedProfile` component. Replace the existing return of `AuthenticatedProfile` to navigate to the profile page:

In the `AuthenticatedProfile` component, add a `useRouter` import and a link to the full profile. Alternatively, the simplest approach is to add a "View Full Profile" button that navigates:

At the top of the file, add:

```typescript
import { useRouter } from "expo-router";
```

In the `AuthenticatedProfile` component, add `const router = useRouter();` and add a button after the profile header:

```tsx
      <Pressable
        style={styles.viewProfileButton}
        onPress={() => router.push(`/profile/${user.id}`)}
      >
        <Text style={styles.viewProfileButtonText}>View Full Profile</Text>
      </Pressable>
```

Add the corresponding style:

```typescript
  viewProfileButton: {
    backgroundColor: colors.maroon[600],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 24,
  },
  viewProfileButtonText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
  },
```

- [ ] **Step 4: Verify compilation**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing warnings).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/profile/ apps/mobile/app/saved.tsx apps/mobile/app/\(tabs\)/profile.tsx
git commit -m "feat: add mobile profile screen, saved posts screen, profile tab navigation"
```

---

## Task 13: Mobile — Post Detail Enhancements (Save, Mark Sold, Review)

**Files:**
- Modify: `apps/mobile/app/posts/[id].tsx`

This task adds save toggle, mark-sold bottom sheet, and review form to the mobile post detail screen. The changes follow the same patterns as the web post detail (Task 10) but use React Native components.

- [ ] **Step 1: Add save, mark-sold, and review to mobile post detail**

In `apps/mobile/app/posts/[id].tsx`, add the following:

**New imports:**

```typescript
import { useAuth } from "@/hooks/useAuth";
import { useSavedPosts } from "@/hooks/useSavedPosts";
import { useTransaction } from "@/hooks/useTransaction";
import { useReview } from "@/hooks/useReview";
import { api } from "@/lib/api";
```

**New state and hooks** (inside the component):

```typescript
  const { user } = useAuth();
  const { isSaved, toggleSave, initSavedState } = useSavedPosts();
  const { createTransaction, isSubmitting: isTransacting } = useTransaction();
  const { eligibility, submitReview, isSubmitting: isReviewing } = useReview(post?.id, post?.status);

  const [showMarkSold, setShowMarkSold] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; cnetId: string; avatarUrl: string | null }>>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string; cnetId: string } | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
```

**Initialize saved state** when post loads:

```typescript
  useEffect(() => {
    if (post) initSavedState(post.id, (post as any).isSaved || false);
  }, [post?.id]);
```

**User search with debounce:**

```typescript
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await api.users.search(searchQuery);
        setSearchResults(results);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
```

**Handle mark sold:**

```typescript
  async function handleMarkSold() {
    if (!selectedBuyer || !post) return;
    const result = await createTransaction(post.id, selectedBuyer.id);
    if (result) {
      setShowMarkSold(false);
      // Refresh post detail
      fetchPost();
    }
  }
```

**Handle review submit:**

```typescript
  async function handleSubmitReview() {
    if (!eligibility?.revieweeId || !post || reviewRating === 0) return;
    const success = await submitReview({
      postId: post.id,
      revieweeId: eligibility.revieweeId,
      rating: reviewRating,
      text: reviewText || null,
    });
    if (success) {
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewText("");
      Alert.alert("Review submitted!");
    }
  }
```

**UI elements to add in the render JSX:**

**Save button** — add a heart icon Pressable near the title:

```tsx
  <Pressable onPress={() => toggleSave(post.id)} style={{ padding: 8 }}>
    <FontAwesome
      name={isSaved(post.id) ? "heart" : "heart-o"}
      size={22}
      color={isSaved(post.id) ? colors.error : colors.gray[400]}
    />
  </Pressable>
```

**Mark as Sold/Completed button** — visible to post author when active:

```tsx
  {post.status === "active" && user?.id === post.authorId && (
    <Pressable
      style={{ backgroundColor: colors.success, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 }}
      onPress={() => setShowMarkSold(true)}
    >
      <Text style={{ color: colors.white, fontWeight: "700", fontSize: 14 }}>
        Mark as {post.type === "marketplace" ? "Sold" : "Completed"}
      </Text>
    </Pressable>
  )}
```

**Review button** — visible when eligible:

```tsx
  {eligibility?.eligible && !eligibility.alreadyReviewed && (
    <Pressable
      style={{ backgroundColor: colors.maroon[600], borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 }}
      onPress={() => setShowReviewForm(true)}
    >
      <Text style={{ color: colors.white, fontWeight: "700", fontSize: 14 }}>
        Leave a Review for {eligibility.revieweeName}
      </Text>
    </Pressable>
  )}
```

**Status badge** — when post is sold/completed:

```tsx
  {(post.status === "sold" || post.status === "completed") && (
    <View style={{ backgroundColor: colors.gray[100], borderRadius: 12, padding: 14, alignItems: "center", marginTop: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.gray[600] }}>
        This post has been {post.status === "sold" ? "sold" : "completed"}
      </Text>
    </View>
  )}
```

The mark-sold and review modals should use React Native `Modal` component with the same search/form patterns as the web version but using `TextInput`, `Pressable`, and `FlatList` instead of HTML elements.

- [ ] **Step 2: Verify compilation**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing warnings).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/posts/
git commit -m "feat: add save, mark-sold, and review features to mobile post detail"
```

---

## Task 14: Final Verification & Cleanup

**Files:** None new — verification only.

- [ ] **Step 1: Type-check entire monorepo**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart && npx turbo typecheck 2>&1 | tail -20
```

If there's no `typecheck` task in turbo.json, run each app individually:

```bash
npx tsc --noEmit -p apps/api/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json && npx tsc --noEmit -p packages/shared/tsconfig.json
```

Expected: All pass with zero errors.

- [ ] **Step 2: Verify API starts**

```bash
cd apps/api && npx tsx src/index.ts &
sleep 3
curl -s http://localhost:3000/api/health | head -5
kill %1
```

Expected: `{ "status": "ok" }` or similar health response.

- [ ] **Step 3: Verify web builds**

```bash
cd apps/web && npx next build 2>&1 | tail -10
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Review all new routes are registered**

Check `apps/api/src/index.ts` has all routes:

```
app.use("/api/transactions", transactionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/saved", savedRoutes);
```

- [ ] **Step 5: Commit if any cleanup was needed**

```bash
git add -A && git status
# Only commit if there are changes
git diff --cached --quiet || git commit -m "fix: phase 3 cleanup — type errors and build fixes"
```
