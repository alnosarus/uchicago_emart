# Reports & Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a trust-and-safety report system so users can flag bad posts and admins (`noh@uchicago.edu`, `junseo@uchicago.edu`) can triage them in-app with delete / ban / warn actions. Unblocks the web launch.

**Architecture:** New `reports` table (posts-only, tri-state lifecycle) + two new boolean columns on `User` (`isAdmin`, `isBanned`). `requireAuth` middleware gets a DB-backed ban check; new `requireAdmin` middleware gates the admin routes. One `POST /api/reports` for users, two `GET/PATCH /api/admin/reports` endpoints for admins. Web UI: small report link on post detail → modal; new `/admin/reports` page with tabs and inline action buttons.

**Tech Stack:** Prisma + Postgres, Express + TypeScript, Next.js 16.2.2 App Router, React 19, Tailwind CSS 4, Zod.

**Spec:** [docs/superpowers/specs/2026-04-07-reports-moderation-design.md](../specs/2026-04-07-reports-moderation-design.md)

---

## Critical context before you start

1. **Next.js 16 / React 19 breaking changes.** [apps/web/AGENTS.md](../../apps/web/AGENTS.md) says this version has breaking changes from training data. Before writing route handlers, middleware, or async server components, check the relevant guide in `apps/web/node_modules/next/dist/docs/01-app/`. Don't trust muscle memory.

2. **No test framework exists.** The repo has zero automated tests and no vitest/jest setup. Do NOT scaffold a test framework as part of this plan — that's a separate project. Every task uses **manual verification** (curl against the dev API, or clicking through the web UI) instead of TDD steps. A post-launch TODO to add vitest is fine but out of scope here.

3. **Shared package must be rebuilt.** `packages/shared` compiles to `dist/`. After editing any file under `packages/shared/src/`, run `pnpm --filter @uchicago-marketplace/shared build` before the API or web can see the changes.

4. **Commit after every task.** Each task produces a working checkpoint. If something breaks midway, you should be able to `git reset --hard HEAD` back to the last green task.

5. **Don't touch mobile.** The `apps/mobile/` directory is out of scope. Mobile will ship reports in a later release.

---

## File Structure

### Created

```
apps/api/prisma/migrations/<timestamp>_add_reports_moderation/migration.sql
apps/api/src/middleware/admin.ts                  ← requireAdmin middleware
apps/api/src/services/report.service.ts           ← createReport, listReports, resolveReport
apps/api/src/routes/reports.ts                    ← POST /api/reports
apps/api/src/routes/admin.ts                      ← GET/PATCH /api/admin/reports/*
packages/shared/src/types/report.ts
packages/shared/src/schemas/report.schema.ts
packages/shared/src/api-client/reports.ts
apps/web/src/components/ui/Modal.tsx              ← shared modal primitive
apps/web/src/components/ui/ConfirmDialog.tsx      ← confirm dialog built on Modal
apps/web/src/components/posts/ReportPostModal.tsx
apps/web/src/app/admin/layout.tsx                 ← admin gate
apps/web/src/app/admin/page.tsx                   ← redirect to /admin/reports
apps/web/src/app/admin/reports/page.tsx           ← admin reports list
apps/web/src/components/admin/ReportCard.tsx
apps/web/src/components/admin/WarnUserModal.tsx
```

### Modified

```
apps/api/prisma/schema.prisma                     ← add isAdmin, isBanned, Report model, enums
apps/api/src/middleware/auth.ts                   ← async + isBanned check in requireAuth
apps/api/src/routes/users.ts                      ← return isAdmin from /me/profile
apps/api/src/index.ts                             ← register reports + admin routers
packages/shared/src/types/index.ts                ← export report types
packages/shared/src/types/user.ts                 ← add isAdmin? to UserProfilePrivate (optional)
packages/shared/src/schemas/index.ts              ← export report schemas
packages/shared/src/api-client/index.ts           ← export reports api client
apps/web/src/lib/auth-context.tsx                 ← add isAdmin to User interface + profile fetch
apps/web/src/app/posts/[id]/client-page.tsx       ← add Report link + modal
apps/web/src/components/Navbar.tsx                ← (optional) show "Admin" link for admins
```

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_reports_moderation/migration.sql` (via Prisma CLI)

- [ ] **Step 1: Add `isAdmin` and `isBanned` columns to the `User` model**

In `apps/api/prisma/schema.prisma`, find the `User` model (around line 12) and add two columns after `isVerified`:

```prisma
model User {
  id         String   @id @default(uuid())
  email      String   @unique
  name       String
  phone      String?
  avatarUrl  String?  @map("avatar_url")
  isVerified Boolean  @default(false) @map("is_verified")
  isAdmin    Boolean  @default(false) @map("is_admin")
  isBanned   Boolean  @default(false) @map("is_banned")
  googleId   String   @unique @map("google_id")
  cnetId     String   @unique @map("cnet_id")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  posts              Post[]
  reviewsGiven       Review[]       @relation("ReviewerReviews")
  reviewsReceived    Review[]       @relation("RevieweeReviews")
  savedPosts         SavedPost[]
  notifications      Notification[]
  conversationsAs1   Conversation[] @relation("Participant1")
  conversationsAs2   Conversation[] @relation("Participant2")
  messagesSent       Message[]
  transactionsSold   Transaction[]  @relation("TransactionsSold")
  transactionsBought Transaction[]  @relation("TransactionsBought")
  reportsSent        Report[]       @relation("ReportsSent")
  reportsResolved    Report[]       @relation("ReportsResolved")

  @@map("users")
}
```

- [ ] **Step 2: Add `reports` relation to the `Post` model**

Find the `Post` model (around line 69) and add `reports Report[]` alongside the other relations:

```prisma
model Post {
  id          String     @id @default(uuid())
  authorId    String     @map("author_id")
  type        PostType
  side        PostSide
  status      PostStatus @default(active)
  title       String
  description String?
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")
  expiresAt           DateTime?  @map("expires_at")
  expirationNotified  Boolean    @default(false) @map("expiration_notified")

  author        User                @relation(fields: [authorId], references: [id])
  images        PostImage[]
  marketplace   MarketplaceDetails?
  storage       StorageDetails?
  housing       HousingDetails?
  savedBy       SavedPost[]
  reviews       Review[]
  conversations Conversation[]
  transaction   Transaction?
  reports       Report[]

  @@index([type, status])
  @@index([authorId])
  @@index([createdAt])
  @@map("posts")
}
```

- [ ] **Step 3: Add `Report` model and two enums at the end of the schema**

Append to the bottom of `apps/api/prisma/schema.prisma`:

```prisma
// ── Reports ───────────────────────────────────

enum ReportCategory {
  spam
  scam
  prohibited_item
  harassment
  misleading
  other
}

enum ReportStatus {
  open
  dismissed
  actioned
}

model Report {
  id          String         @id @default(uuid())
  postId      String         @map("post_id")
  reporterId  String         @map("reporter_id")
  category    ReportCategory
  detail      String?
  status      ReportStatus   @default(open)
  resolvedBy  String?        @map("resolved_by")
  resolvedAt  DateTime?      @map("resolved_at")
  actionTaken String?        @map("action_taken")
  createdAt   DateTime       @default(now()) @map("created_at")

  post     Post  @relation(fields: [postId], references: [id])
  reporter User  @relation("ReportsSent", fields: [reporterId], references: [id])
  resolver User? @relation("ReportsResolved", fields: [resolvedBy], references: [id])

  @@unique([postId, reporterId])
  @@index([status, createdAt])
  @@map("reports")
}
```

- [ ] **Step 4: Generate and run the migration**

```bash
cd apps/api
pnpm prisma migrate dev --name add_reports_moderation
```

Expected output: "Your database is now in sync with your schema." and a new folder under `prisma/migrations/` containing `migration.sql`. Prisma client is regenerated automatically.

- [ ] **Step 5: Smoke-test the schema**

```bash
cd apps/api
pnpm prisma studio
```

Open `http://localhost:5555`, verify the `reports` table exists with all columns, and that `users` table has new `is_admin` and `is_banned` columns. Close Studio when done.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add reports table and admin/banned flags on users"
```

---

## Task 2: Shared package — types, schemas, API client

**Files:**
- Create: `packages/shared/src/types/report.ts`
- Create: `packages/shared/src/schemas/report.schema.ts`
- Create: `packages/shared/src/api-client/reports.ts`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/api-client/index.ts`

- [ ] **Step 1: Create the report types file**

Create `packages/shared/src/types/report.ts` with:

```ts
export type ReportCategory =
  | "spam"
  | "scam"
  | "prohibited_item"
  | "harassment"
  | "misleading"
  | "other";

export type ReportStatus = "open" | "dismissed" | "actioned";

export type ReportAction =
  | { action: "dismiss" }
  | { action: "delete_post" }
  | { action: "ban_user" }
  | { action: "warn_user"; category: ReportCategory; detail?: string };

export interface Report {
  id: string;
  postId: string;
  reporterId: string;
  category: ReportCategory;
  detail: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  actionTaken: string | null;
  createdAt: string;
}

export interface ReportWithDetails extends Report {
  reporter: {
    id: string;
    name: string;
    email: string;
  };
  post: {
    id: string;
    title: string;
    status: string;
    author: {
      id: string;
      name: string;
      email: string;
    };
  };
  resolver: {
    id: string;
    name: string;
  } | null;
}

export interface ListReportsResponse {
  reports: ReportWithDetails[];
  total: number;
  page: number;
  limit: number;
}
```

- [ ] **Step 2: Create the Zod schemas file**

Create `packages/shared/src/schemas/report.schema.ts` with:

```ts
import { z } from "zod";

export const reportCategoryEnum = z.enum([
  "spam",
  "scam",
  "prohibited_item",
  "harassment",
  "misleading",
  "other",
]);

export const createReportSchema = z.object({
  postId: z.string().uuid(),
  category: reportCategoryEnum,
  detail: z.string().max(1000).optional(),
});

export const resolveReportSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("delete_post") }),
  z.object({ action: z.literal("ban_user") }),
  z.object({
    action: z.literal("warn_user"),
    category: reportCategoryEnum,
    detail: z.string().max(1000).optional(),
  }),
]);

export const listReportsQuerySchema = z.object({
  status: z.enum(["open", "dismissed", "actioned"]).optional(),
  category: reportCategoryEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
```

- [ ] **Step 3: Create the API client file**

Create `packages/shared/src/api-client/reports.ts` with:

```ts
import type { ApiClient } from "./client";
import type {
  Report,
  ReportWithDetails,
  ListReportsResponse,
  ReportCategory,
  ReportStatus,
  ReportAction,
} from "../types/report";

export class ReportsApi {
  constructor(private client: ApiClient) {}

  createReport(postId: string, category: ReportCategory, detail?: string) {
    return this.client.request<Report>("/api/reports", {
      method: "POST",
      body: { postId, category, detail },
    });
  }

  listReports(params: {
    status?: ReportStatus;
    category?: ReportCategory;
    page?: number;
    limit?: number;
  } = {}) {
    return this.client.request<ListReportsResponse>("/api/admin/reports", {
      params: {
        status: params.status,
        category: params.category,
        page: params.page,
        limit: params.limit,
      },
    });
  }

  resolveReport(reportId: string, action: ReportAction) {
    return this.client.request<ReportWithDetails>(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      body: action,
    });
  }
}
```

- [ ] **Step 4: Export from the package barrels**

Add to `packages/shared/src/types/index.ts`:

```ts
export * from "./report";
```

(Add it alongside the existing `export *` lines.)

Add to `packages/shared/src/schemas/index.ts`:

```ts
export * from "./report.schema";
```

Add to `packages/shared/src/api-client/index.ts`:

```ts
export * from "./reports";
```

- [ ] **Step 5: Build the shared package and typecheck**

```bash
pnpm --filter @uchicago-marketplace/shared build
```

Expected: no errors, `packages/shared/dist/` is regenerated with new `.js` and `.d.ts` files for reports.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/ packages/shared/dist/
git commit -m "feat(shared): add report types, schemas, and api client"
```

---

## Task 3: Auth middleware + /me/profile updates

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/admin.ts`
- Modify: `apps/api/src/routes/users.ts`

- [ ] **Step 1: Update `requireAuth` to check `isBanned`**

Replace the body of `requireAuth` in `apps/api/src/middleware/auth.ts` with an async version that fetches the ban status. The full updated file:

```ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/auth";
import { prisma } from "../config/database";

export interface AuthRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid authorization header" });
    return;
  }

  const token = header.slice(7);
  let userId: string;
  try {
    const payload = jwt.verify(token, JWT_CONFIG.accessSecret) as { userId: string };
    userId = payload.userId;
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }

  // Check ban status on every authenticated request.
  // One cheap indexed PK lookup; ensures bans take effect immediately.
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });
    if (!user) {
      res.status(401).json({ message: "Account not found" });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ message: "Account banned", code: "ACCOUNT_BANNED" });
      return;
    }
    req.userId = userId;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  // Must be used AFTER requireAuth
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  prisma.user
    .findUnique({ where: { id: req.userId }, select: { isVerified: true } })
    .then((user) => {
      if (!user || !user.isVerified) {
        res.status(403).json({ message: "Phone verification required", code: "VERIFICATION_REQUIRED" });
        return;
      }
      next();
    })
    .catch(() => {
      res.status(500).json({ message: "Internal server error" });
    });
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_CONFIG.accessSecret) as { userId: string };
    req.userId = payload.userId;
  } catch {
    // Invalid token — proceed without auth
  }
  next();
}
```

- [ ] **Step 2: Create the `requireAdmin` middleware**

Create `apps/api/src/middleware/admin.ts`:

```ts
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { prisma } from "../config/database";

// Must be used AFTER requireAuth. Fetches isAdmin fresh from DB every request
// so that demotions take effect immediately (no JWT claim staleness).
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      res.status(403).json({ message: "Admin only" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
```

- [ ] **Step 3: Update `/api/users/me/profile` to return `isAdmin`**

In `apps/api/src/routes/users.ts`, find the `GET /me/profile` handler (around line 53). Update the `prisma.user.findUnique` select to include `isAdmin`:

```ts
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
          isAdmin: true,
          createdAt: true,
        },
      }),
```

The response already spreads `...user`, so `isAdmin` flows through to the client automatically.

- [ ] **Step 4: Typecheck the API**

```bash
pnpm --filter @uchicago-marketplace/api typecheck
```

Expected: no errors. If you see "Property 'isAdmin' does not exist on type 'User'", Prisma client wasn't regenerated — run `cd apps/api && pnpm prisma generate`.

- [ ] **Step 5: Manual verification**

Start the API dev server in a separate terminal:
```bash
pnpm --filter @uchicago-marketplace/api dev
```

In another terminal, get a JWT by logging into the web app (`pnpm --filter @uchicago-marketplace/web dev`) and copying the `accessToken` from browser devtools. Then:

```bash
curl http://localhost:3000/api/users/me/profile \
  -H "Authorization: Bearer <YOUR_TOKEN>" | jq .isAdmin
```

Expected: `false` (you haven't promoted yourself yet). No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/middleware/admin.ts apps/api/src/routes/users.ts
git commit -m "feat(api): add ban enforcement in requireAuth and requireAdmin middleware"
```

---

## Task 4: Report service

**Files:**
- Create: `apps/api/src/services/report.service.ts`

- [ ] **Step 1: Create the service file with `createReport`**

Create `apps/api/src/services/report.service.ts`:

```ts
import { Prisma, type ReportCategory } from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";
import type { ResolveReportInput, ListReportsQuery } from "@uchicago-marketplace/shared";

const WARN_TEMPLATES: Record<ReportCategory, string> = {
  spam: "Your post was flagged as spam. Please review our posting guidelines.",
  scam: "Your post was flagged as a potential scam. Do not request payment before meetup.",
  prohibited_item: "Your post contains a prohibited item and has been flagged.",
  harassment: "Your post was flagged for harassment. Please review our community guidelines.",
  misleading: "Your post was flagged as misleading. Please update it with accurate information.",
  other: "Your post was flagged by a moderator.",
};

export async function createReport(
  reporterId: string,
  postId: string,
  category: ReportCategory,
  detail?: string
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true },
  });
  if (!post || post.status === "deleted") {
    throw new HttpError(404, "Post not found");
  }
  if (post.authorId === reporterId) {
    throw new HttpError(400, "You cannot report your own post");
  }

  try {
    return await prisma.report.create({
      data: {
        postId,
        reporterId,
        category,
        detail: detail ?? null,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new HttpError(409, "You have already reported this post");
    }
    throw err;
  }
}
```

- [ ] **Step 2: Add `listReports` to the same file**

Append to `apps/api/src/services/report.service.ts`:

```ts
export async function listReports(query: ListReportsQuery) {
  const { status = "open", category, page, limit } = query;
  const where = {
    status,
    ...(category ? { category } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        post: {
          select: {
            id: true,
            title: true,
            status: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
        resolver: { select: { id: true, name: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, total, page, limit };
}
```

- [ ] **Step 3: Add `resolveReport` with the transaction**

Append to `apps/api/src/services/report.service.ts`:

```ts
export async function resolveReport(
  reportId: string,
  adminId: string,
  action: ResolveReportInput
) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: reportId },
      include: { post: { select: { id: true, authorId: true } } },
    });
    if (!report) {
      throw new HttpError(404, "Report not found");
    }
    if (report.status !== "open") {
      throw new HttpError(400, "Report already resolved");
    }

    let actionTaken: string | null = null;

    switch (action.action) {
      case "dismiss":
        break;

      case "delete_post":
        await tx.post.update({
          where: { id: report.postId },
          data: { status: "deleted" },
        });
        actionTaken = "deleted";
        break;

      case "ban_user": {
        const authorId = report.post.authorId;
        await tx.user.update({
          where: { id: authorId },
          data: { isBanned: true },
        });
        await tx.post.updateMany({
          where: { authorId, status: "active" },
          data: { status: "deleted" },
        });
        actionTaken = "banned";
        break;
      }

      case "warn_user":
        await tx.notification.create({
          data: {
            userId: report.post.authorId,
            type: "system",
            title: `Warning: ${action.category.replace("_", " ")}`,
            body: action.detail ?? WARN_TEMPLATES[action.category],
            link: `/posts/${report.postId}`,
          },
        });
        actionTaken = "warned";
        break;
    }

    return tx.report.update({
      where: { id: reportId },
      data: {
        status: action.action === "dismiss" ? "dismissed" : "actioned",
        resolvedBy: adminId,
        resolvedAt: new Date(),
        actionTaken,
      },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        post: {
          select: {
            id: true,
            title: true,
            status: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
        resolver: { select: { id: true, name: true } },
      },
    });
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @uchicago-marketplace/api typecheck
```

Expected: no errors. If `ResolveReportInput` or `ListReportsQuery` aren't found, you forgot to build the shared package in Task 2 — run `pnpm --filter @uchicago-marketplace/shared build`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/report.service.ts
git commit -m "feat(api): add report service with create, list, and resolve"
```

---

## Task 5: Report routes + wire into app

**Files:**
- Create: `apps/api/src/routes/reports.ts`
- Create: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create the user-facing reports router**

Create `apps/api/src/routes/reports.ts`:

```ts
import { Router } from "express";
import type { Response } from "express";
import { requireAuth, requireVerified, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createReportSchema } from "@uchicago-marketplace/shared";
import { createReport } from "../services/report.service";

const router = Router();

// POST /api/reports — User reports a post
router.post(
  "/",
  requireAuth,
  requireVerified,
  validate(createReportSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const { postId, category, detail } = req.body;
      const report = await createReport(req.userId!, postId, category, detail);
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 2: Create the admin router**

Create `apps/api/src/routes/admin.ts`:

```ts
import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";
import { validate } from "../middleware/validate";
import {
  listReportsQuerySchema,
  resolveReportSchema,
} from "@uchicago-marketplace/shared";
import { listReports, resolveReport } from "../services/report.service";

const router = Router();

// All admin routes require auth + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/reports
router.get(
  "/reports",
  validate(listReportsQuerySchema, "query"),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const result = await listReports(req.query as never);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/admin/reports/:id
router.patch(
  "/reports/:id",
  validate(resolveReportSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const report = await resolveReport(req.params.id, req.userId!, req.body);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
```

- [ ] **Step 3: Register both routers in `index.ts`**

In `apps/api/src/index.ts`, add the imports and mount them. The full file after edit:

```ts
import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { initSocket } from "./socket";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import postRoutes from "./routes/posts";
import transactionRoutes from "./routes/transactions";
import reviewRoutes from "./routes/reviews";
import savedRoutes from "./routes/saved";
import notificationRoutes from "./routes/notifications";
import conversationRoutes from "./routes/conversations";
import reportRoutes from "./routes/reports";
import adminRoutes from "./routes/admin";

const app = express();
const server = createServer(app);

const CORS_ORIGINS = [
  "http://localhost:3001",
  "http://localhost:8081",
  "https://www.uchicagoemart.com",
  "https://uchicagoemart.com",
];

// Middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Socket.IO
initSocket(server, CORS_ORIGINS);

server.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
  console.log(`Health check: http://localhost:${env.PORT}/api/health`);
});

export default app;
```

- [ ] **Step 4: Typecheck and restart the dev server**

```bash
pnpm --filter @uchicago-marketplace/api typecheck
```

Expected: no errors.

Start (or restart) the dev server:
```bash
pnpm --filter @uchicago-marketplace/api dev
```

- [ ] **Step 5: Manual verification via curl**

In a separate terminal, with a valid access token `$TOKEN` from a verified user:

```bash
# Should 403 — you're not an admin yet
curl -i http://localhost:3000/api/admin/reports \
  -H "Authorization: Bearer $TOKEN"
# Expected: HTTP/1.1 403 Forbidden, {"message":"Admin only"}

# Grab a real post ID from the DB (or browse the app and copy from the URL)
export POST_ID="<some-uuid-of-a-post-NOT-owned-by-your-user>"

# Should 201 — file a report
curl -i -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"postId\":\"$POST_ID\",\"category\":\"scam\",\"detail\":\"test report\"}"
# Expected: HTTP/1.1 201 Created, report JSON

# Should 409 — duplicate
curl -i -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"postId\":\"$POST_ID\",\"category\":\"scam\"}"
# Expected: HTTP/1.1 409 Conflict
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/reports.ts apps/api/src/routes/admin.ts apps/api/src/index.ts
git commit -m "feat(api): add POST /api/reports and admin GET/PATCH /api/admin/reports"
```

---

## Task 6: Web auth context — expose isAdmin

**Files:**
- Modify: `apps/web/src/lib/auth-context.tsx`

- [ ] **Step 1: Add `isAdmin` to the User interface**

In `apps/web/src/lib/auth-context.tsx`, update the `User` interface at the top of the file (around line 5):

```ts
interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  isAdmin: boolean;
}
```

The profile fetch endpoint `/api/users/me/profile` already returns `isAdmin` after Task 3, so no fetch logic changes are needed — the data will flow through once the type allows it.

- [ ] **Step 2: Typecheck the web app**

```bash
pnpm --filter @uchicago-marketplace/web exec tsc --noEmit
```

Expected: no errors. If there are errors like "Property 'isAdmin' is missing", there's a place that constructs a User literal — search for `{ id:`, `email:`, `isVerified:` in sequence and add `isAdmin: false` (or find where the server response is used and make sure it's typed as `User`).

- [ ] **Step 3: Manual verification**

Start the web dev server:
```bash
pnpm --filter @uchicago-marketplace/web dev
```

Open `http://localhost:3001`, log in, open browser devtools → Application → Local Storage (or inspect the React tree) and confirm the auth context user has `isAdmin: false`.

Alternatively, in the browser console:
```js
fetch("http://localhost:3000/api/users/me/profile", {
  headers: { Authorization: `Bearer ${localStorage.getItem("at") ?? ""}` },
}).then(r => r.json()).then(console.log)
```

Expected: response includes `isAdmin: false`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth-context.tsx
git commit -m "feat(web): expose isAdmin on auth context user"
```

---

## Task 7: Shared Modal + ConfirmDialog primitives

**Files:**
- Create: `apps/web/src/components/ui/Modal.tsx`
- Create: `apps/web/src/components/ui/ConfirmDialog.tsx`

**Context:** The existing app has an inline `ConfirmDeleteDialog` in [apps/web/src/app/posts/[id]/client-page.tsx:302](../../apps/web/src/app/posts/%5Bid%5D/client-page.tsx#L302). Use its Tailwind classes as the visual reference so new modals match the existing style. Don't delete or refactor the existing inline dialog yet — that's out of scope.

- [ ] **Step 1: Create the Modal primitive**

Create `apps/web/src/components/ui/Modal.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional footer for action buttons */
  footer?: ReactNode;
  /** Max width class — default max-w-md */
  maxWidthClass?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidthClass = "max-w-md" }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the ConfirmDialog component**

Create `apps/web/src/components/ui/ConfirmDialog.tsx`:

```tsx
"use client";

import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" shows a red confirm button; "default" shows a neutral one */
  variant?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmClasses =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-gray-900 hover:bg-gray-800 text-white";

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${confirmClasses}`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-500 whitespace-pre-line">{message}</p>
    </Modal>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @uchicago-marketplace/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat(web): add Modal and ConfirmDialog UI primitives"
```

---

## Task 8: ReportPostModal + integrate into post detail page

**Files:**
- Create: `apps/web/src/components/posts/ReportPostModal.tsx`
- Modify: `apps/web/src/app/posts/[id]/client-page.tsx`

- [ ] **Step 1: Create the ReportPostModal component**

Create `apps/web/src/components/posts/ReportPostModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useAuth } from "@/lib/auth-context";
import type { ReportCategory } from "@uchicago-marketplace/shared";

interface ReportPostModalProps {
  open: boolean;
  postId: string;
  onClose: () => void;
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export function ReportPostModal({ open, postId, onClose }: ReportPostModalProps) {
  const { fetchAuth } = useAuth();
  const [category, setCategory] = useState<ReportCategory>("scam");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const reset = () => {
    setCategory("scam");
    setDetail("");
    setBanner(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setBusy(true);
    setBanner(null);
    const res = await fetchAuth("/api/reports", {
      method: "POST",
      body: JSON.stringify({ postId, category, detail: detail.trim() || undefined }),
    });
    setBusy(false);

    if (!res) {
      setBanner({ kind: "error", text: "You must be logged in to report." });
      return;
    }
    if (res.status === 201) {
      setBanner({ kind: "success", text: "Report submitted. Thanks — an admin will review it." });
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
      return;
    }
    if (res.status === 409) {
      setBanner({ kind: "error", text: "You've already reported this post." });
      return;
    }
    if (res.status === 403) {
      setBanner({ kind: "error", text: "You must verify your phone number before reporting." });
      return;
    }
    const body = await res.json().catch(() => ({ message: "Failed to submit report" }));
    setBanner({ kind: "error", text: body.message || "Failed to submit report" });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Report this post"
      footer={
        <>
          <button
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Submit report"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            disabled={busy}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Details (optional)
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
            disabled={busy}
            rows={4}
            placeholder="What's wrong with this post?"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <span className="block text-xs text-gray-400 mt-1">{detail.length}/1000</span>
        </label>

        {banner && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              banner.kind === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {banner.text}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Find the right place for the Report link on the post detail page**

Open `apps/web/src/app/posts/[id]/client-page.tsx` and read the top-level JSX returned by the default-exported component. Locate the block that renders the post's author info (likely near `post.author.name` — search for `author.name`). The Report link should sit in that area, visible but not prominent.

- [ ] **Step 3: Add state + import + link + modal to client-page.tsx**

Near the top of the file, add imports (merge with existing import lines):

```tsx
import { ReportPostModal } from "@/components/posts/ReportPostModal";
```

Inside the main client component (the one that has `useState` for other things), add:

```tsx
const [showReportModal, setShowReportModal] = useState(false);
```

Where the author info is rendered, add a Report button nearby. The existing author block is likely something like `<span>{post.author.name}</span>` — add this next to it (only for users viewing someone else's post; hide for the post owner):

```tsx
{user && post.author.id !== user.id && (
  <button
    type="button"
    onClick={() => setShowReportModal(true)}
    className="text-xs text-gray-400 hover:text-red-600 underline underline-offset-2 ml-2"
    aria-label="Report this post"
  >
    ⚐ Report
  </button>
)}
```

Then, just before the closing JSX of the component (alongside the existing `{showDeleteDialog && ...}` block), add:

```tsx
<ReportPostModal
  open={showReportModal}
  postId={post.id}
  onClose={() => setShowReportModal(false)}
/>
```

If `user` isn't already in scope, add `const { user } = useAuth();` near the other hook calls. Check if `useAuth` is already imported; if not, add `import { useAuth } from "@/lib/auth-context";`.

- [ ] **Step 4: Typecheck and manual test**

```bash
pnpm --filter @uchicago-marketplace/web exec tsc --noEmit
```

Expected: no errors.

Restart the web dev server and navigate to any post detail page (as a non-owner). Verify:
1. You see a small "⚐ Report" link near the author name.
2. Clicking it opens the modal.
3. Selecting a category, filling in detail, and submitting shows "Report submitted, thanks" banner for ~1.5s then closes.
4. Clicking it again and submitting on the same post shows "You've already reported this post."
5. Navigate to your own post — the Report link should NOT appear.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/posts/ReportPostModal.tsx apps/web/src/app/posts/\[id\]/client-page.tsx
git commit -m "feat(web): add report button and modal to post detail page"
```

---

## Task 9: Admin layout + gate

**Files:**
- Create: `apps/web/src/app/admin/layout.tsx`
- Create: `apps/web/src/app/admin/page.tsx`

**Important:** Before writing this task, skim `apps/web/node_modules/next/dist/docs/01-app/` to confirm the App Router `layout.tsx` conventions haven't changed from what you know. In particular, the rules for client vs server components and how to redirect from a layout. Your training data may be out of date for Next 16.

- [ ] **Step 1: Create the admin layout with client-side gate**

Create `apps/web/src/app/admin/layout.tsx`. Since we need to read the auth context (which is client-only), this layout is a client component:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!user.isAdmin) {
      router.replace("/");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user?.isAdmin) {
    // The effect will redirect; render nothing in the meantime.
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <p className="text-sm text-gray-500">Moderation tools for UChicago E-Mart</p>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create the /admin index page that redirects to reports**

Create `apps/web/src/app/admin/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/reports");
  }, [router]);
  return null;
}
```

- [ ] **Step 3: Manual verification**

Start the web dev server if not running. As a NON-admin user, navigate to `http://localhost:3001/admin`. You should be redirected to `/` after a brief flash.

You'll test the admin view in Task 10 after promoting yourself.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/
git commit -m "feat(web): add admin layout with access gate"
```

---

## Task 10: Admin reports page — list, tabs, filters

**Files:**
- Create: `apps/web/src/app/admin/reports/page.tsx`

**Before starting:** skim `apps/web/node_modules/next/dist/docs/01-app/` for any Next 16 changes to client-side data fetching in pages. We'll use plain `fetchAuth` from the auth context (no server components), so this should be straightforward, but double-check.

- [ ] **Step 1: Create the reports page with tab state and data fetching**

Create `apps/web/src/app/admin/reports/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type {
  ListReportsResponse,
  ReportStatus,
  ReportCategory,
  ReportWithDetails,
  ReportAction,
} from "@uchicago-marketplace/shared";
import { ReportCard } from "@/components/admin/ReportCard";

const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "dismissed", label: "Dismissed" },
  { value: "actioned", label: "Actioned" },
];

const CATEGORIES: { value: "" | ReportCategory; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export default function AdminReportsPage() {
  const { fetchAuth } = useAuth();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [category, setCategory] = useState<"" | ReportCategory>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListReportsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ status, page: String(page), limit: "20" });
    if (category) qs.set("category", category);
    const res = await fetchAuth(`/api/admin/reports?${qs.toString()}`);
    if (!res) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: "Failed to load reports" }));
      setError(body.message || "Failed to load reports");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as ListReportsResponse;
    setData(json);
    setLoading(false);
  }, [fetchAuth, status, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolved = (updated: ReportWithDetails) => {
    // Remove from current list if its new status no longer matches the tab
    if (!data) return;
    if (updated.status !== status) {
      setData({
        ...data,
        reports: data.reports.filter((r) => r.id !== updated.id),
        total: data.total - 1,
      });
    } else {
      setData({
        ...data,
        reports: data.reports.map((r) => (r.id === updated.id ? updated : r)),
      });
    }
  };

  const resolveReport = async (reportId: string, action: ReportAction) => {
    const res = await fetchAuth(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify(action),
    });
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => ({})) : {};
      throw new Error(body.message || "Failed to resolve report");
    }
    const updated = (await res.json()) as ReportWithDetails;
    handleResolved(updated);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      {/* Tab bar */}
      <nav className="flex gap-1 border-b border-gray-200 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              status === tab.value
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
            {status === tab.value && data && ` (${data.total})`}
          </button>
        ))}
      </nav>

      {/* Category filter */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mr-2">
          Category:
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as "" | ReportCategory);
            setPage(1);
          }}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading && <div className="text-gray-500">Loading reports...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && data && data.reports.length === 0 && (
        <div className="text-gray-400 py-12 text-center">No reports in this tab.</div>
      )}
      {!loading && !error && data && data.reports.length > 0 && (
        <div className="space-y-3">
          {data.reports.map((report) => (
            <ReportCard key={report.id} report={report} onResolve={resolveReport} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.limit && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @uchicago-marketplace/web exec tsc --noEmit
```

Expected: one error about `ReportCard` not existing yet — that's fine, we create it in Task 11. If there are other errors, fix them before moving on.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/reports/
git commit -m "feat(web): add admin reports list page with tabs and pagination"
```

---

## Task 11: ReportCard + WarnUserModal + action handlers

**Files:**
- Create: `apps/web/src/components/admin/ReportCard.tsx`
- Create: `apps/web/src/components/admin/WarnUserModal.tsx`

- [ ] **Step 1: Create the WarnUserModal component**

Create `apps/web/src/components/admin/WarnUserModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import type { ReportCategory } from "@uchicago-marketplace/shared";

interface WarnUserModalProps {
  open: boolean;
  initialCategory: ReportCategory;
  onCancel: () => void;
  onSubmit: (category: ReportCategory, detail?: string) => Promise<void>;
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export function WarnUserModal({ open, initialCategory, onCancel, onSubmit }: WarnUserModalProps) {
  const [category, setCategory] = useState<ReportCategory>(initialCategory);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(category, detail.trim() || undefined);
      setDetail("");
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send warning");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title="Warn user"
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send warning"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            disabled={busy}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Custom message (optional)
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
            disabled={busy}
            rows={4}
            placeholder="Leave blank to send the default warning for this category."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <span className="block text-xs text-gray-400 mt-1">{detail.length}/1000</span>
        </label>

        {error && (
          <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-800 border border-red-200">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Create the ReportCard component**

Create `apps/web/src/components/admin/ReportCard.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportWithDetails, ReportAction, ReportCategory } from "@uchicago-marketplace/shared";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { WarnUserModal } from "./WarnUserModal";

interface ReportCardProps {
  report: ReportWithDetails;
  onResolve: (reportId: string, action: ReportAction) => Promise<void>;
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  scam: "SCAM",
  spam: "SPAM",
  prohibited_item: "PROHIBITED",
  harassment: "HARASSMENT",
  misleading: "MISLEADING",
  other: "OTHER",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ReportCard({ report, onResolve }: ReportCardProps) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = report.status === "open";

  const run = async (action: ReportAction) => {
    setBusy(true);
    setError(null);
    try {
      await onResolve(report.id, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
      setConfirmBan(false);
      setShowWarn(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-block px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded">
          {CATEGORY_LABELS[report.category]}
        </span>
        <span className="text-xs text-gray-500">
          reported {timeAgo(report.createdAt)} by {report.reporter.name} ({report.reporter.email})
        </span>
      </div>

      {/* Post info */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Post</div>
        <div className="text-base font-semibold text-gray-900">{report.post.title}</div>
        <div className="text-xs text-gray-500">
          by {report.post.author.name} ({report.post.author.email}) · status: {report.post.status}
        </div>
      </div>

      {/* Detail */}
      {report.detail && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Reporter note
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-line">{report.detail}</div>
        </div>
      )}

      {/* Resolution info for non-open reports */}
      {!isOpen && (
        <div className="mb-3 text-xs text-gray-500">
          {report.status === "dismissed" ? "Dismissed" : "Actioned"}
          {report.resolver && ` by ${report.resolver.name}`}
          {report.resolvedAt && ` on ${new Date(report.resolvedAt).toLocaleString()}`}
          {report.actionTaken && ` — action: ${report.actionTaken}`}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Actions (only for open reports) */}
      {isOpen && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <Link
            href={`/posts/${report.post.id}`}
            target="_blank"
            className="px-3 py-1.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View Post
          </Link>
          <button
            onClick={() => run({ action: "dismiss" })}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Delete Post
          </button>
          <button
            onClick={() => setConfirmBan(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-800 rounded-lg hover:bg-red-900 disabled:opacity-50"
          >
            Ban User
          </button>
          <button
            onClick={() => setShowWarn(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            Warn User
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete post?"
        message={`This will mark "${report.post.title}" as deleted and hide it from the marketplace. This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete post"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run({ action: "delete_post" })}
      />

      <ConfirmDialog
        open={confirmBan}
        title={`Ban ${report.post.author.name}?`}
        message={`This will ban ${report.post.author.name} (${report.post.author.email}) AND delete ALL of their active posts. The user will be locked out immediately. This cannot be undone from the UI.`}
        variant="danger"
        confirmLabel="Ban user"
        busy={busy}
        onCancel={() => setConfirmBan(false)}
        onConfirm={() => run({ action: "ban_user" })}
      />

      <WarnUserModal
        open={showWarn}
        initialCategory={report.category}
        onCancel={() => setShowWarn(false)}
        onSubmit={async (category, detail) => {
          await run({ action: "warn_user", category, detail });
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @uchicago-marketplace/web exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/admin/
git commit -m "feat(web): add admin ReportCard with delete/ban/warn actions"
```

---

## Task 12: Manual end-to-end test + admin bootstrap

**Files:** none (operational task)

**Goal:** promote yourself to admin in the dev DB, walk the manual test plan, and verify everything works end-to-end before merging.

- [ ] **Step 1: Promote yourself to admin in the dev DB**

Find your user's email (the one you log into the dev app with). Run:

```bash
cd apps/api
pnpm prisma studio
```

Open `http://localhost:5555`, navigate to the `users` table, find your row, toggle `is_admin` to `true`, save. Do the same for a second test user if you have one.

Alternatively, via `psql`:
```bash
psql $DATABASE_URL -c "UPDATE users SET is_admin = true WHERE email = '<your-email>';"
```

- [ ] **Step 2: Happy path — report a post**

1. In a separate browser profile (or incognito), log in as a DIFFERENT user who owns a post.
2. In your main browser (as the admin user), navigate to that user's post detail page.
3. Click "⚐ Report", pick "Scam", add detail "test report 1", submit.
4. Verify success banner.

- [ ] **Step 3: Happy path — admin list view**

1. Navigate to `http://localhost:3001/admin/reports`.
2. You should see the open report with correct post title, reporter, detail, and category badge.
3. Click the "Open" / "Dismissed" / "Actioned" tabs — Open should have 1, the others 0.

- [ ] **Step 4: Happy path — delete post action**

1. On the report card, click "Delete Post" → confirm.
2. Verify the card disappears from Open tab.
3. Navigate to the Actioned tab — the report should be there with "action: deleted".
4. Navigate to `/posts/<that-post-id>` — it should either show as deleted or be inaccessible.
5. Navigate to `/browse` — the post should NOT appear.

- [ ] **Step 5: Happy path — warn user**

1. Have the other user (non-admin) post a second post.
2. Report it as admin with category "spam".
3. In the admin queue, click "Warn User" → modal opens with "spam" pre-selected → add custom text → submit.
4. Verify the report moves to Actioned with "action: warned".
5. Switch to the warned user's browser — navigate to `/notifications` — verify they received the warning notification.

- [ ] **Step 6: Happy path — ban user (cascade)**

1. Have the other user post a third post. They should now have 2 active posts (one from step 5, one new).
2. Report one of them as admin.
3. In the admin queue, click "Ban User" → confirm the scary cascade dialog.
4. Verify the report moves to Actioned with "action: banned".
5. Switch to the banned user's browser — try to do anything (browse, click a post). You should get booted with a "banned" message or get 403s in network tab.
6. Via Prisma Studio or psql, verify:
   - The user's `is_banned = true`
   - Both of their active posts are now `status = deleted`

- [ ] **Step 7: Sad paths**

In the main (admin) browser:

1. **Can't report own post:** navigate to one of your own posts. The "⚐ Report" link should NOT appear (hidden for post owner). Force-test via DevTools console:
   ```js
   fetch("http://localhost:3000/api/reports", {
     method: "POST",
     headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("at") ?? "<paste your token>"}` },
     body: JSON.stringify({ postId: "<id of one of your own posts>", category: "spam" }),
   }).then(r => r.status)
   ```
   Expected: `400`.

2. **Duplicate report:** try to re-report an already-reported post. Expected: banner "You've already reported this post."

3. **Non-admin can't reach admin routes:** In a normal (non-admin) browser, navigate to `/admin/reports`. You should be redirected to `/`. Then:
   ```js
   fetch("http://localhost:3000/api/admin/reports", {
     headers: { Authorization: `Bearer ${localStorage.getItem("at") ?? ""}` },
   }).then(r => r.status)
   ```
   Expected: `403`.

4. **Double-resolve race:** open two admin tabs on the same open report, click "Dismiss" in both. First one succeeds, second one shows an error banner ("Report already resolved").

5. **Banned user with stale JWT:** before banning the test user, copy their access token from DevTools. Ban them. Have them (or you using that token via curl) hit any authenticated endpoint:
   ```bash
   curl -i http://localhost:3000/api/users/me/profile -H "Authorization: Bearer <stale-token>"
   ```
   Expected: `403 Account banned`.

6. **Demoted admin:** In Prisma Studio, flip your own `is_admin` back to `false`. Refresh `/admin/reports`. You should be redirected to `/` and the API call should return 403.

- [ ] **Step 8: Un-ban the test user (cleanup)**

```bash
psql $DATABASE_URL -c "UPDATE users SET is_banned = false WHERE email = '<test-user-email>';"
```

Note: their old posts stay `deleted` by design (spec Q11-B).

- [ ] **Step 9: Re-promote yourself to admin**

If you demoted yourself in Step 7, flip `is_admin` back:

```bash
psql $DATABASE_URL -c "UPDATE users SET is_admin = true WHERE email = '<your-email>';"
```

- [ ] **Step 10: Final typecheck across the monorepo**

```bash
pnpm -r typecheck
```

Expected: no errors anywhere.

- [ ] **Step 11: Commit any loose changes and tag the feature complete**

There shouldn't be any new file changes from Step 1-10 (this was a test pass), but if you fixed a small bug along the way:

```bash
git status
# If clean, nothing to commit. Otherwise:
git add .
git commit -m "fix(reports): <describe the fix>"
```

---

## Production rollout checklist (NOT part of this plan's tasks)

Once the manual test passes and the PR merges:

1. Deploy the API to Railway
2. Run the migration on production: Railway runs `prisma migrate deploy` automatically on build, or manually: `pnpm --filter @uchicago-marketplace/api exec prisma migrate deploy`
3. Promote admins in production:
   ```sql
   UPDATE users SET is_admin = true WHERE email IN ('noh@uchicago.edu', 'junseo@uchicago.edu');
   ```
4. Smoke test on production: log in as one of the admin accounts, file a test report on a test post, resolve it, verify it moves tabs.
5. The report link is discoverable but subtle — no announcement needed unless you want one.

---

## Self-review checklist (for the plan author)

Done before handing off:

- ✅ **Spec coverage:** every decision from the spec Q&A maps to a task
  - Q1 (in-app queue) → Tasks 10, 11
  - Q2 (posts only) → Task 1 schema
  - Q3 (isAdmin boolean) → Task 1 + Task 3
  - Q4 (category + detail) → Task 2 (schemas)
  - Q5 (tri-state) → Task 1 (enum), Task 4 (service)
  - Q6 (delete/ban/warn, no edit) → Task 4 (service) + Task 11 (UI)
  - Q7 (no edit) → not in plan ✓
  - Q8 (hard ban) → Task 3 (requireAuth)
  - Q9 (preset + custom warn) → Task 4 + Task 11
  - Q10 (unique constraint) → Task 1 (@@unique)
  - Q11 (cascade active → deleted) → Task 4 (transaction)
- ✅ **Security properties from spec:**
  - isAdmin never user-settable → existing PATCH /me schema unchanged + no new /me endpoint that sets admin
  - requireAdmin reads from DB on every request → Task 3 Step 2
  - requireAuth reads isBanned from DB on every request → Task 3 Step 1
- ✅ **No placeholders:** every "Step N" has actual code or actual commands
- ✅ **Type consistency:** `ReportCategory`, `ReportStatus`, `ReportAction`, `ReportWithDetails` all defined once in Task 2 and used consistently in Tasks 4, 5, 10, 11
- ✅ **Commit cadence:** every task ends with a commit step
