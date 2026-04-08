# Reports & Moderation — Design Spec

**Date:** 2026-04-07
**Status:** Approved, ready for implementation plan
**Scope:** Web-only launch blocker. Mobile deferred.

## Problem

The app has no trust-and-safety surface. Users can't flag scam listings, prohibited items, or harassment. Without this, launching to ~5k UChicago students is irresponsible — community moderation is the only trust signal since the platform doesn't handle payments.

## Goals

- Authenticated users can report a post and provide context
- Two admins (`noh@uchicago.edu`, `junseo@uchicago.edu`) can triage reports in-app
- Admins can delete offending posts, ban repeat offenders, or warn authors
- Banned users are locked out immediately, not on JWT expiry

## Non-goals

- Mobile report UI (defer until web launch settles)
- Automated tests (no test framework exists in the repo; separate TODO)
- User appeal flow (manual: email the admins)
- Admin notifications for new reports (admins will check the page manually)
- Bulk moderation actions
- Report thresholds / auto-hide (premature; add if volume warrants)
- Moderator audit log beyond the `resolvedBy`/`resolvedAt`/`actionTaken` fields on `reports`

## Decisions (Q&A summary)

| # | Question | Decision |
|---|---|---|
| Q1 | Scope of MVP | **B** — In-app moderation queue with admin UI |
| Q2 | What can be reported | **A** — Posts only (not users or messages directly) |
| Q3 | Admin identification | **B** — `isAdmin` boolean on User, set via SQL |
| Q4 | Report reasons | **C** — Preset category + optional free-text detail |
| Q5 | Report lifecycle | **B** — Tri-state: `open` → `dismissed` / `actioned` |
| Q6 | Admin actions | **C** — delete post, ban user, warn user (no edit) |
| Q7 | "Edit post" action | **C** — Drop it; delete-and-ask-to-repost instead |
| Q8 | Ban semantics | **A** — Hard ban; 403 on every authenticated call |
| Q9 | Warn semantics | **C** — Preset category + optional custom text |
| Q10 | Duplicate reports | **A** — Unique constraint per `(reporter, post)` |
| Q11 | Banned user's existing posts | **B** — Cascade to `status = deleted` in the same txn |

## Security analysis

The `isAdmin` boolean approach is safe **if and only if** two properties hold:

1. **`isAdmin` is never user-settable via any API endpoint.** Currently safe because [validate.ts:11](../../apps/api/src/middleware/validate.ts#L11) replaces `req.body` with Zod's parsed output, and [users.ts:163-167](../../apps/api/src/routes/users.ts#L163) whitelists only `name`, `phone`, `avatarUrl` on `PATCH /users/me`. Implementation must not add new endpoints that naively spread `req.body` into a User update.

2. **Admin checks read `isAdmin` from the DB, not from the JWT.** `requireAdmin` middleware does a fresh `findUnique` on every request. This adds one cheap indexed lookup but guarantees demotions take effect immediately.

The same rule applies to `isBanned`: `requireAuth` is modified to fetch `isBanned` from the DB on every authenticated request. At ~5k users this is a non-issue; the alternative (embedding in JWT) means bans take up to 15 min to propagate, which is unacceptable for moderation actions.

## Data model

### User table — two new columns

```prisma
model User {
  // ... existing fields
  isAdmin   Boolean @default(false) @map("is_admin")
  isBanned  Boolean @default(false) @map("is_banned")

  // ... existing relations
  reportsSent     Report[] @relation("ReportsSent")
  reportsResolved Report[] @relation("ReportsResolved")
}
```

### Report table — new

```prisma
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
  actionTaken String?        @map("action_taken")  // "deleted" | "banned" | "warned" | null
  createdAt   DateTime       @default(now()) @map("created_at")

  post     Post  @relation(fields: [postId], references: [id])
  reporter User  @relation("ReportsSent", fields: [reporterId], references: [id])
  resolver User? @relation("ReportsResolved", fields: [resolvedBy], references: [id])

  @@unique([postId, reporterId])
  @@index([status, createdAt])
  @@map("reports")
}
```

`actionTaken` is a nullable string (not an enum) so new actions can be added without migrations. Values are validated in the service layer.

### Migration

Single migration adds the two User columns, the two new enums, the `reports` table, and the unique + composite indexes. Existing users default to `isAdmin = false`, `isBanned = false`.

Post-migration SQL (manual, per environment):

```sql
UPDATE users SET is_admin = true WHERE email IN ('noh@uchicago.edu', 'junseo@uchicago.edu');
```

## API

### User-facing

```
POST /api/reports            (requireAuth + requireVerifiedPhone)
  body: { postId: string, category: ReportCategory, detail?: string (max 1000) }
  201 → { id, status: "open" }
  400 → reporting own post
  404 → post doesn't exist or already deleted
  409 → already reported by this user (unique constraint)
```

Gated by `requireVerifiedPhone` (same pattern as posting and messaging) — only verified students can report.

### Admin-facing

```
GET /api/admin/reports       (requireAuth + requireAdmin)
  query: ?status=open|dismissed|actioned (default: open)
         &category=spam|scam|...
         &page=1&limit=20
  200 → {
    reports: [{
      id, category, detail, status, createdAt,
      resolvedBy, resolvedAt, actionTaken,
      reporter: { id, name, email },
      post: { id, title, status, author: { id, name, email } },
      resolver: { id, name } | null,
    }],
    total, page, limit
  }
```

```
PATCH /api/admin/reports/:id  (requireAuth + requireAdmin)
  body: discriminated union on "action"
    { action: "dismiss" }
    { action: "delete_post" }
    { action: "ban_user" }
    { action: "warn_user", category: ReportCategory, detail?: string }
  200 → { report } (fully hydrated, same shape as list item)
  400 → report already resolved
  404 → report not found
```

## Middleware

### New: `requireAdmin`

```ts
// apps/api/src/middleware/admin.ts
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { isAdmin: true, isBanned: true },
  });
  if (!user?.isAdmin || user.isBanned) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
}
```

### Modified: `requireAuth`

Add an `isBanned` check after JWT validation. If the user is banned, return `403 { message: "Account banned" }`. This is one extra `findUnique({ select: { isBanned: true } })` per authenticated request.

## Service layer

New file: `apps/api/src/services/report.service.ts`.

### `createReport(reporterId, postId, category, detail?)`

- Verify post exists and `status !== 'deleted'` (else 404)
- Reject if `post.authorId === reporterId` (400)
- Insert row; unique constraint raises on duplicate, caught as 409

### `listReports({ status, category, page, limit })`

- `WHERE` filters on status (default `open`) and optional category; ordered by `createdAt DESC`
- Uses `[status, createdAt]` index
- Eager-loads `reporter`, `post.author`, `resolver`
- Returns `{ reports, total, page, limit }`

### `resolveReport(reportId, adminId, action)`

Wrapped in `prisma.$transaction` because every action mutates multiple rows.

```ts
async function resolveReport(reportId, adminId, action) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: reportId },
      include: { post: true },
    });
    if (!report) throw new HttpError(404, "Report not found");
    if (report.status !== "open") throw new HttpError(400, "Report already resolved");

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
        await tx.user.update({ where: { id: authorId }, data: { isBanned: true } });
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
            title: `Warning: ${action.category}`,
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
        post: { include: { author: { select: { id: true, name: true, email: true } } } },
        resolver: { select: { id: true, name: true } },
      },
    });
  });
}
```

### `WARN_TEMPLATES`

```ts
const WARN_TEMPLATES: Record<ReportCategory, string> = {
  spam: "Your post was flagged as spam. Please review our posting guidelines.",
  scam: "Your post was flagged as a potential scam. Do not request payment before meetup.",
  prohibited_item: "Your post contains a prohibited item and has been flagged.",
  harassment: "Your post was flagged for harassment. Please review our community guidelines.",
  misleading: "Your post was flagged as misleading. Please update it with accurate information.",
  other: "Your post was flagged by a moderator.",
};
```

## Edge cases (explicit)

| Edge case | Behavior |
|---|---|
| User reports own post | 400 at create time |
| User reports already-deleted post | 404 at create time |
| User reports same post twice | 409 (unique constraint) |
| Two admins resolve same report simultaneously | Second gets 400; `status !== 'open'` check inside transaction catches it |
| Admin deletes a post that was already deleted (user deleted first) | Idempotent — `status = deleted` overwrites itself, report still marked `actioned` |
| Admin bans a user with no active posts | Transaction runs, `updateMany` updates 0 rows, user still banned |
| Admin bans an already-banned user | Idempotent, report still marked `actioned` |
| Banned user presents a pre-ban JWT | `requireAuth` fetches `isBanned`, returns 403 |
| Admin gets banned (manual DB mistake) | `requireAdmin` also checks `isBanned`, returns 403 — can't admin their way out |
| Admin unbans via SQL | User works again, old posts remain `deleted` (no restore; per Q11) |
| Admin is demoted mid-session | Fresh DB lookup in `requireAdmin` catches it on the next request |

## Web UI

### Routes

```
apps/web/src/app/admin/
├── layout.tsx              ← admin gate: server-side check + client redirect for non-admins
├── page.tsx                ← redirect to /admin/reports
└── reports/
    └── page.tsx            ← tabs, filters, paginated list
```

Access control: server enforces via `requireAdmin` on every API call; client-side gate is UX only. Non-admins visiting `/admin/*` get redirected to `/`.

### Components

```
apps/web/src/components/admin/
├── ReportCard.tsx          ← single report with inline actions
├── WarnUserModal.tsx       ← category pre-filled from report, optional custom text
└── ConfirmDialog.tsx       ← if no reusable one exists; check first
```

```
apps/web/src/components/posts/
└── ReportPostModal.tsx     ← category dropdown + detail textarea
```

### Admin page layout

```
/admin/reports
├── Tab bar: Open (N) | Dismissed | Actioned
├── Filter: category dropdown
├── Paginated report cards (20/page)
└── Pagination footer
```

### Report card

```
┌─────────────────────────────────────────────────────┐
│ [SCAM]  reported 2h ago by Alice Chen               │
│                                                     │
│ Post:  "MacBook Pro M3 $200 urgent sale"            │
│        by Bob Smith (bob@uchicago.edu) · active     │
│                                                     │
│ Detail: "Seller asked for Venmo upfront then..."    │
│                                                     │
│ [View Post]  [Dismiss]  [Delete Post]               │
│              [Ban User]  [Warn User]                │
└─────────────────────────────────────────────────────┘
```

- **View Post** → opens `/posts/:id` in new tab (no special admin view)
- **Dismiss** → immediate PATCH, card fades out
- **Delete Post** → confirm dialog → PATCH
- **Ban User** → confirm dialog emphasizing cascade ("will also delete all N of Bob's active posts") → PATCH
- **Warn User** → modal with category pre-filled + optional detail → PATCH

Cards in `Dismissed` and `Actioned` tabs show resolver name + timestamp, hide action buttons.

### Report button (user-facing)

Add a small "⚐ Report" link in the post metadata area on [apps/web/src/app/posts/[id]/client-page.tsx](../../apps/web/src/app/posts/[id]/client-page.tsx), near the author name. Not prominent. Clicking opens `ReportPostModal`.

```
Report this post
─────────────────
Category: [dropdown]
Details (optional): [textarea, 1000 char limit]
                                [Cancel] [Submit]
```

On submit → POST `/api/reports` → toast "Report submitted, thanks" or "You've already reported this post" on 409. No report button on browse cards — forces the user to read the post first.

## Shared package

Add to `packages/shared`:

```ts
// types/report.ts
export type ReportCategory =
  | "spam"
  | "scam"
  | "prohibited_item"
  | "harassment"
  | "misleading"
  | "other";
export type ReportStatus = "open" | "dismissed" | "actioned";

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

// schemas/report.schema.ts
const reportCategoryEnum = z.enum([
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

// api-client/reports.ts — exports:
//   createReport(postId, category, detail?)
//   listReports({ status?, category?, page?, limit? })  (admin)
//   resolveReport(reportId, action)                     (admin)
```

## Manual test plan

No test framework exists in the repo (post-launch TODO). These are manual tests to run before merging.

**Setup:** seed one admin, one normal user, one "bad actor" with 3 active posts + 1 sold post.

**Happy paths:**
1. Normal user reports a post with "scam" + detail → toast confirms → DB row exists
2. Admin visits `/admin/reports` → sees the open report
3. Admin clicks Delete Post → confirm → post is `deleted`, report in Actioned tab, post not in browse
4. Admin clicks Warn User → modal with pre-filled category → adds text → submits → target gets notification
5. Admin clicks Ban User → confirms cascade → user `isBanned`, all 3 active posts `deleted`, sold post untouched, report `actioned`

**Sad paths:**
1. User reports own post → 400
2. User reports same post twice → 409
3. Non-admin visits `/admin/reports` → client redirects, API returns 403
4. Banned user logs in and hits any endpoint → 403 "Account banned"
5. Banned user with pre-ban JWT → 403 on next request
6. Two tabs resolve same report → second gets 400 "already resolved"
7. Admin demoted mid-session (SQL flip) → next admin request returns 403

## Rollout

1. Run migration on local dev DB
2. Manually set `isAdmin = true` on a dev user
3. Execute manual test plan on `localhost`
4. Deploy API
5. Run migration on production
6. Set `isAdmin = true` on both admin accounts in production
7. Production smoke test
8. (Optional) Announce or leave discoverable via the report button

## Open items for implementation plan

- Check whether a reusable `Modal` / `ConfirmDialog` primitive exists before creating new ones
- Decide where exactly the report link goes on the post detail page (near author name, near status badge, or in a kebab menu)
- Confirm that `requireVerifiedPhone` middleware already exists — the messaging feature uses something equivalent, probably already present
