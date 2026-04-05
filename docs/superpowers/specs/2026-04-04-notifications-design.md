# In-App Notifications — Design Spec

## Overview

In-app notification system for UChicago Marketplace. Triggers notifications on review, save, and post expiration events. Includes API endpoints, notification feed page on web and mobile, navbar bell with unread badge (poll-based, upgradeable to Socket.IO later), and post renewal from expiration notifications.

This is sub-project 1 of Phase 4. Messaging (sub-project 2) and push notifications (sub-project 3) follow separately.

## Decisions

| Decision | Choice |
|----------|--------|
| Notification triggers | Review, save, expiring (3 days before), system |
| Save notifications | Instant (one per save, no batching) |
| Expiration reminder | 3 days before, with "Renew" action (extends 30 days) |
| Real-time delivery | Poll every 30s now; upgrade to Socket.IO with messaging sub-project |
| Excluded from this spec | Message notifications (sub-project 2), push notifications (sub-project 3), storage match notifications (deferred) |

## 1. API — Notification Service + Endpoints

### Notification Service

File: `apps/api/src/services/notification.service.ts`

**Core functions:**
- `createNotification(userId, type, title, body, link?)` — Creates a notification record in the DB
- `getUserNotifications(userId, page, limit)` — Paginated list, newest first, returns notifications + pagination info
- `getUnreadCount(userId)` — Returns count where `isRead === false`
- `markAsRead(notificationId, userId)` — Sets `isRead = true` for a single notification (validates ownership)
- `markAllAsRead(userId)` — Sets `isRead = true` for all of a user's notifications

### Triggers

Notifications are created by calling `createNotification` from existing service functions:

**Review trigger** — in `review.service.ts`, after a review is created:
- Recipient: the reviewee (post author)
- Type: `review`
- Title: `"New Review"`
- Body: `"{reviewerName} left you a {rating}-star review on '{postTitle}'"`
- Link: `/posts/{postId}`

**Save trigger** — in `saved.service.ts`, after a post is saved:
- Recipient: the post author
- Type: `save`
- Title: `"Post Saved"`
- Body: `"Someone saved your post '{postTitle}'"`
- Link: `/posts/{postId}`
- Do NOT notify if the user saves their own post

**Expiration check** — lightweight, no external scheduler:
- On the `GET /api/notifications` endpoint, before returning results, check if any of the user's active posts have `expiresAt` within 3 days and haven't been notified yet
- Add `expirationNotified` Boolean field (default false) to the `Post` model to prevent duplicate notifications
- Type: `expiring`
- Title: `"Post Expiring Soon"`
- Body: `"Your post '{postTitle}' expires in 3 days. Renew it to keep it active."`
- Link: `/posts/{postId}`

**System notifications** — created manually or via a future admin tool:
- `createSystemNotification(userId, title, body, link?)` — convenience wrapper

### API Endpoints

File: `apps/api/src/routes/notifications.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Required | List user's notifications (paginated, triggers expiration check) |
| GET | `/api/notifications/unread-count` | Required | Returns `{ count: number }` |
| PATCH | `/api/notifications/:id/read` | Required | Mark one notification as read |
| PATCH | `/api/notifications/read-all` | Required | Mark all user's notifications as read |

### Post Renewal Endpoint

Add to existing `apps/api/src/routes/posts.ts`:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PATCH | `/api/posts/:id/renew` | Required (owner) | Extends `expiresAt` by 30 days from now, resets `expirationNotified` to false |

### Schema Changes

Add to `Post` model in `apps/api/prisma/schema.prisma`:
```prisma
expirationNotified Boolean @default(false) @map("expiration_notified")
```

## 2. Web — Notification Bell + Feed Page

### Navbar Bell Icon

Added to existing navbar components (home page, browse page, etc.):
- Bell SVG icon with red circular badge showing unread count
- Polls `GET /api/notifications/unread-count` every 30 seconds (only when user is authenticated)
- Badge hidden when count is 0
- Clicking navigates to `/notifications`

### Notifications Page (`/notifications`)

- Paginated list, newest first
- Each notification row shows:
  - Type icon (review → star, save → heart, expiring → clock, system → megaphone)
  - Title (bold if unread)
  - Body text
  - Relative time ("2h ago")
  - Unread indicator (highlighted background or dot)
- Clicking a notification: marks as read via API, navigates to `link`
- "Mark all as read" button at the top
- Expiring notifications include an inline "Renew" button that calls `PATCH /api/posts/:id/renew` without navigating away
- Empty state: "No notifications yet"
- No-index metadata (private page)

## 3. Mobile — Notification Screen

### Header Bell Icon

- Bell icon in screen headers (not a tab — existing tabs stay)
- Red badge with unread count, same 30-second polling
- Tapping opens notifications screen

### Notifications Screen (`apps/mobile/app/notifications.tsx`)

- FlatList with pull-to-refresh, paginated (load more on scroll)
- Same content as web: type icon, title, body, relative time, read/unread styling
- Tapping marks as read, navigates to relevant screen (post detail via `router.push`)
- "Mark all as read" button in header
- Expiring notifications show inline "Renew" button
- Empty state

## 4. Shared Types + API Client

### Types

Already defined in `packages/shared/src/types/notification.ts` — no changes needed.

### API Client

Add `createNotificationsApi` to `packages/shared/src/api-client/`:

```typescript
list(page?, limit?) → GET /api/notifications
getUnreadCount() → GET /api/notifications/unread-count
markAsRead(id) → PATCH /api/notifications/:id/read
markAllAsRead() → PATCH /api/notifications/read-all
```

Add to existing posts API client:

```typescript
renew(postId) → PATCH /api/posts/:id/renew
```

Export `createNotificationsApi` from the shared API client index.
