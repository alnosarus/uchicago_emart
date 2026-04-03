# Phase 3: Social Features — Design Spec

## Overview

Phase 3 adds transactions, reviews, saved posts, and user profiles to the UChicago eMart marketplace. The central design decision is **transaction-gated reviews**: users can only review each other after a post is marked as sold/completed with a recorded counterparty. This requires pulling post status management (originally Phase 5) forward as a prerequisite.

### Build Order

1. Database migration (transactions table + cnetId column)
2. User search endpoint
3. Transaction & post status management
4. Reviews (gated by transactions)
5. Saved posts (independent)
6. Profile aggregation
7. Web UI
8. Mobile UI

### Key Decisions (from brainstorming)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Review gating | Transaction-gated | Prevents fake reviews; only real transaction parties can review |
| Transaction tracking | Dedicated `transactions` table | Clean separation from posts; supports future transaction history, disputes, analytics |
| Counterparty identification | User search by name + cnet ID | Cnet ID is unique per student, prevents name collisions |
| cnetId storage | Denormalized column on `users` | Indexable for search; derived from email, set once at creation |
| Saved post notifications | Silent (no notification) | Notifications are Phase 4; save is a personal bookmark for now |
| Profile transaction display | Count only | Privacy — specific transaction details are not public |
| Profile reviews | Received only | Matches marketplace norms (eBay, Airbnb); "reviews given" has no user value on public profiles |
| User search placement | `GET /api/users/search` | Reusable for messaging (Phase 4) and future features |

---

## 1. Database Changes

### New table: `transactions`

```prisma
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

- One transaction per post (`@@unique([postId])`)
- `sellerId` = post author regardless of post side (sell/buy/has_space/need_storage/offering/looking)
- No status field on transaction — post's `status` enum (`sold`/`completed`) is the source of truth

### New column on `users`: `cnetId`

```prisma
cnetId String @unique @map("cnet_id")
```

- Derived from `email.split('@')[0]` at user creation time
- Backfill via migration: `UPDATE users SET cnet_id = split_part(email, '@', 1)`
- Indexed (unique constraint) for fast search

### New relations on existing models

- `User`: add `transactionsSold Transaction[]` and `transactionsBought Transaction[]`
- `Post`: add `transaction Transaction?`
- `Review`: add `@@unique([postId, reviewerId])` to enforce one review per reviewer per transaction

### Post status mapping by type

| Post type | Status on completion |
|-----------|---------------------|
| marketplace | `sold` |
| storage | `completed` |
| housing | `completed` |

---

## 2. API — User Search

### `GET /api/users/search?q=<query>`

- **Auth:** `requireAuth`
- **Query:** `q` — searches `name` (case-insensitive contains) and `cnetId` (case-insensitive prefix) via OR
- **Response:** `{ id, name, cnetId, avatarUrl }[]` — max 10 results
- **Excludes:** The requesting user
- **Placement:** Added to existing `routes/users.ts`

---

## 3. API — Transactions & Status Management

### `POST /api/transactions`

- **Auth:** `requireAuth`
- **Body:** `{ postId: uuid, buyerId: uuid }`
- **Validation:**
  - Requesting user must be the post author
  - Post must be in `active` status
  - `buyerId` must be a valid user and not the post author
- **Side effects:**
  - Creates `Transaction` record
  - Updates post `status` to `sold` (marketplace) or `completed` (storage/housing)
- **Response:** Transaction with post and buyer info

### `DELETE /api/transactions/:postId`

- **Auth:** `requireAuth` (post author only)
- **Purpose:** Undo a mistaken sale
- **Guard:** Only allowed within 24 hours of `completedAt`
- **Side effects:**
  - Deletes the `Transaction` record
  - Sets post `status` back to `active`
- **Response:** 204

### Service: `transaction.service.ts`

Functions: `createTransaction`, `undoTransaction`, `getTransactionByPostId`, `getUserTransactionCount`

### Route: `routes/transactions.ts`

New route file, registered in `index.ts`.

---

## 4. API — Reviews

### `POST /api/reviews`

- **Auth:** `requireAuth`
- **Body:** `{ postId, revieweeId, rating, text? }` (validated by existing `createReviewSchema`)
- **Validation (in service layer):**
  - Transaction must exist for `postId`
  - Reviewer must be `sellerId` or `buyerId` on that transaction
  - `revieweeId` must be the other party
  - No existing review by this reviewer for this post (`@@unique([postId, reviewerId])`)
- **Response:** Created review with reviewer info

### `GET /api/users/:id/reviews`

- **Auth:** `optionalAuth`
- **Query:** `page` (default 1), `limit` (default 10)
- **Response:** `{ data: ReviewWithAuthor[], total: number, averageRating: number }`
- **`averageRating`:** Computed via Prisma `aggregate` on `revieweeId`
- **Placement:** In `routes/users.ts` (under `/api/users` namespace), handler delegates to `review.service.ts`

### `GET /api/reviews/eligibility?postId=<id>`

- **Auth:** `requireAuth`
- **Purpose:** Check if current user can review on a given post (and who they'd review)
- **Response:** `{ eligible: boolean, revieweeId?: string, revieweeName?: string, alreadyReviewed: boolean }`
- **Usage:** UI calls this to decide whether to show the "Leave a Review" button

### Design decisions

- No `GET /api/reviews/:id` — reviews are viewed in profile context only
- No edit/delete — reviews are permanent (moderation is a future admin action)
- Eligibility check is a separate endpoint so UI doesn't duplicate gating logic

### Service: `review.service.ts`

Functions: `createReview`, `getReviewsForUser`, `isEligibleToReview`

### Route: `routes/reviews.ts`

New route file, registered in `index.ts`. Handles `POST /api/reviews` and `GET /api/reviews/eligibility`. The `GET /api/users/:id/reviews` endpoint lives in `routes/users.ts` but delegates to `review.service.ts`.

---

## 5. API — Saved Posts

### Endpoints

```
POST   /api/saved/:postId    — Save a post (idempotent, 200 if already saved)
DELETE /api/saved/:postId    — Unsave a post (idempotent, 204 if not saved)
GET    /api/saved            — List saved posts (paginated)
```

- **Auth:** All require `requireAuth`
- **GET response:** `{ data: PostWithDetails[], total: number }` — same shape as `GET /api/posts` for component reuse

### Post listing enrichment

When a logged-in user calls `GET /api/posts`, each post includes `isSaved: boolean`. Implemented via left join on `saved_posts` when `req.userId` is present. Same enrichment on `GET /api/posts/:id`.

**Existing files modified:** `posts.service.ts` (add `isSaved` field to list/detail queries when userId provided), `routes/posts.ts` (pass `req.userId` to service for enrichment).

### Service: `saved.service.ts`

Functions: `savePost`, `unsavePost`, `getSavedPosts`, `getSavedPostIds` (batch helper for enriching listings)

### Route: `routes/saved.ts`

New route file, registered in `index.ts`.

---

## 6. API — Profile Aggregation

### Enriched `GET /api/users/:id`

Updated response shape:

```typescript
{
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
  stats: {
    averageRating: number | null;  // null if no reviews received
    reviewCount: number;
    transactionCount: number;      // sold + bought combined
    activeListingCount: number;
  };
  activePosts: PostWithDetails[];
  reviews: {
    data: ReviewWithAuthor[];
    total: number;
  };
}
```

### Enriched `GET /api/users/me/profile`

Same shape plus private fields: `email`, `phone`.

### Implementation

Four parallel Prisma queries via `Promise.all`:
1. User lookup (with `cnetId`)
2. Stats aggregation (review avg/count, transaction count, active post count)
3. Active posts (where `authorId = id` and `status = active`)
4. First page of reviews (10 most recent received)

No caching — straightforward at this user scale (~17k max).

---

## 7. Shared Package Updates

### New types

- `src/types/transaction.ts` — `Transaction`, `TransactionWithDetails`
- `src/types/user.ts` — updated with `UserProfile` (includes `stats`, `cnetId`), `UserSearchResult`

### New schemas

- `src/schemas/transaction.schema.ts` — `createTransactionSchema` validates `{ postId: uuid, buyerId: uuid }`

### Existing schemas

- `createReviewSchema` — no changes needed (already correct shape)

### New API client modules

- `api-client/reviews.ts` — `createReview`, `getReviewsForUser`, `checkEligibility`
- `api-client/saved.ts` — `savePost`, `unsavePost`, `getSavedPosts`
- `api-client/transactions.ts` — `createTransaction`, `undoTransaction`
- `api-client/users.ts` — `searchUsers`, `getProfile`

### Updated `createApi()` barrel

```typescript
{ auth, posts, reviews, saved, transactions, users }
```

---

## 8. Web UI

### New pages

**`/profile/[id]/page.tsx`** — User profile
- Header: avatar, name, cnetId, verified badge, member since
- Stats row: star rating, review count, transaction count, active listings
- Two tabs: "Listings" (PostCard grid) and "Reviews" (ReviewCards)
- Own profile shows "Edit Profile" link
- Reviews paginate with "Load more"

**`/saved/page.tsx`** — Saved posts (protected route)
- PostCard grid reused from browse page
- Empty state message when no saved posts

### Modifications to existing pages

**Post detail (`/posts/[id]/page.tsx`):**
- Save/unsave toggle button
- "Mark as Sold/Completed" button (visible to post author when post is `active`)
  - Opens modal with user search (name + cnet ID autocomplete)
  - On confirm: creates transaction, updates post status inline
  - Undo option visible for 24 hours
- "Leave a Review" button (visible when eligible per `GET /api/reviews/eligibility`)
  - Opens form: 1-5 star rating + optional text (500 char)
  - Submits via `POST /api/reviews`

**PostCard component:**
- Heart/bookmark icon toggle for save/unsave
- Optimistic UI: toggles immediately, rolls back on API error
- Unauthenticated users: redirect to login on click

**Navbar:**
- Add link to "Saved" page (when authenticated)

---

## 9. Mobile UI

### New/updated screens

**`app/profile/[id].tsx`** — User profile
- Vertical stack layout
- Segmented control for "Listings" / "Reviews" (reuses existing pattern from storage tab)
- Pull-to-refresh on both segments

**`app/(tabs)/profile.tsx`** — Updated to navigate to `profile/[currentUserId]` instead of placeholder

**Saved posts** — Section within profile screen
- "My Saved Posts" tappable row navigates to full-screen saved list
- No new tab (tab bar is already at capacity)

### Modifications to existing screens

**Post detail (`app/posts/[id].tsx`):**
- Save toggle (heart icon)
- "Mark as Sold/Completed" button for post author
  - Opens bottom sheet with user search (consistent with existing filter sheet patterns)
  - Search results as selectable list: name + cnet ID
- "Leave a Review" button when eligible
  - Tappable star rating + text input in bottom sheet

**PostCard component:**
- Heart icon in top-right corner for save/unsave
- Optimistic toggle with rollback

### New hooks

- `useSavedPosts` — tracks saved state across feed without re-fetching
- `useTransaction` — create/undo transaction
- `useReview` — submit review, check eligibility
- `useProfile` — fetch enriched profile data

---

## Future Considerations

These are **not** in scope for Phase 3 but the design accommodates them:

- **Notification on save** — `saved.service.ts` has a clear insertion point for a notification service call when Phase 4 lands
- **Notification on review** — same pattern in `review.service.ts`
- **Transaction history page** — `transactions` table supports full history queries; profile currently shows count only
- **Review responses** — schema could add a `response` field to `Review` model later
- **Messaging integration** — user search endpoint reusable for conversation creation in Phase 4
- **Admin moderation** — reviews/transactions can be flagged without changing user-facing API
