# UChicago Marketplace — Architecture & Implementation Plan

## 1. Requirements Summary

### Functional Requirements

| ID  | Requirement                                                                                 | Priority |
| --- | ------------------------------------------------------------------------------------------- | -------- |
| F1  | Users can create, edit, delete, and browse **Marketplace** posts (buy/sell)                 | Must     |
| F2  | Users can create, edit, delete, and browse **Storage Match** posts (has space/need storage) | Must     |
| F3  | Google OAuth login restricted to `@uchicago.edu` email domain                               | Must     |
| F4  | Phone number verification via SMS code after OAuth                                          | Must     |
| F5  | User profiles with reviews, active posts, and transaction history                           | Must     |
| F6  | Search and filter across all post types                                                     | Must     |
| F7  | Image upload for marketplace listings                                                       | Must     |
| F8  | In-app messaging between users                                                              | Should   |
| F9  | Notification system (new messages, storage matches, reviews, etc.)                          | Should   |
| F10 | Save/favorite posts                                                                         | Should   |
| F11 | Report posts                                                                                | Should   |
| F12 | Mark posts as sold/completed                                                                | Should   |
| F13 | Post expiration and renewal                                                                 | Could    |
| F14 | Storage match suggestions                                                                   | Could    |

### Non-Functional Requirements

| ID  | Requirement                                          | Target              |
| --- | ---------------------------------------------------- | ------------------- |
| NF1 | Platforms: Web, iOS, Android                         | All three at launch |
| NF2 | Hosting: Railway (backend + database)                | Railway             |
| NF3 | Response time: API < 200ms p95                       | Performance         |
| NF4 | Image storage: max 8 images/post, 5MB each           | Storage             |
| NF5 | Concurrent users: ~5,000 UChicago students           | Scale               |
| NF6 | Data persistence: PostgreSQL                         | Reliability         |
| NF7 | Security: only verified UChicago students can access | Trust & Safety      |
| NF8 | Mobile: offline browsing of cached posts             | UX                  |
| NF9 | SEO: browse pages should be indexable                | Discoverability     |

### Constraints

- Budget: student project (minimize paid services)
- Team size: small (1-3 developers)
- Timeline: MVP first, iterate
- User base: UChicago students only (~7,000 undergrads + ~10,000 grads)

---

## 2. High-Level Architecture

```
                        +------------------+
                        |   Expo (Mobile)  |
                        | iOS + Android    |
                        +--------+---------+
                                 |
                                 |  REST/WebSocket
                                 |
+------------------+    +--------v---------+    +-------------------+
|   Next.js (Web)  +--->|  Express API     +--->| PostgreSQL        |
|   SSR + React    |    |  (Node/TS)       |    | (Railway)         |
+------------------+    |  on Railway      |    +-------------------+
                        +----+----+--------+
                             |    |
                    +--------+    +--------+
                    |                      |
            +-------v------+    +---------v--------+
            | Cloudinary   |    | Firebase Cloud    |
            | (Images)     |    | Messaging (Push)  |
            +--------------+    +------------------+
                    |
            +-------v------+
            | Redis        |
            | (Rate limit  |
            |  + sessions) |
            +--------------+
```

### Platform Strategy

| Platform               | Technology                 | Reasoning                                                                                  |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------ |
| **Web**                | Next.js 14 (App Router)    | SSR for SEO on browse pages, React ecosystem, fast iteration                               |
| **iOS + Android**      | Expo (React Native)        | Single codebase for both mobile platforms, OTA updates, shared TypeScript types with web   |
| **Backend API**        | Express.js + TypeScript    | Lightweight, huge ecosystem, easy Railway deployment                                       |
| **Database**           | PostgreSQL on Railway      | Relational data (users/posts/reviews), ACID transactions, Railway native support           |
| **ORM**                | Prisma                     | Type-safe queries, auto-generated types shared with frontend, migrations                   |
| **Image Storage**      | Cloudinary (free tier)     | 25GB free, auto-resize/optimize, CDN delivery, no server storage needed                    |
| **Push Notifications** | Firebase Cloud Messaging   | Free, works on iOS + Android + web, industry standard                                      |
| **SMS Verification**   | Twilio Verify              | Per-verification pricing ($0.05/verify), purpose-built for phone verification              |
| **Real-time**          | Socket.IO                  | Messaging and live notifications, works with Express                                       |
| **Rate Limiting**      | Redis + `rate-limit-redis` | Distributed rate limiting from day one, also usable for Socket.IO adapter if scaling later |

---

## 3. Architecture Decision Records

### ADR-001: PostgreSQL over NoSQL (e.g., MongoDB via Supabase)

**Status:** Recommended

**Context:**
The marketplace has strongly relational data: users have posts, posts have categories, users review other users, messages link two users to a post, storage matches link needs with offers, etc. The user asked whether a NoSQL or BaaS solution like Supabase would be better.

**Decision:** PostgreSQL on Railway directly (not Supabase BaaS).

**Why not Supabase BaaS?**

- Supabase _uses_ PostgreSQL under the hood, so the database engine is the same
- Supabase's value is its auto-generated REST API, built-in auth, and realtime — but these come with vendor lock-in
- For this project, we want a custom API layer (Express) that serves both Next.js and Expo, giving us full control over business logic (domain-restricted OAuth, phone verification, post matching)
- Supabase's free tier has limits (500MB DB, 1GB storage, 50K monthly active users) that could become constraints
- Railway gives us a raw PostgreSQL instance with no abstraction layer in the way

**Why PostgreSQL over MongoDB?**

- Data is inherently relational (users -> posts -> reviews -> messages)
- Need JOIN queries: "show all posts by users I've saved" or "find storage matches for my request"
- ACID transactions for concurrent operations (e.g., marking a post as sold while another user is messaging about it)
- Full-text search built in (no need for Elasticsearch for basic search)
- PostGIS extension available if we add location-based features later

**Trade-offs:**

- (+) Strong consistency, relational queries, mature tooling
- (+) Prisma ORM gives us type safety across the stack
- (-) Schema migrations required for changes (Prisma handles this well)
- (-) Slightly more setup than Supabase BaaS (but more control)

---

### ADR-002: Separate Web (Next.js) + Mobile (Expo) over Single Codebase

**Status:** Recommended

**Context:**
We need web + iOS + Android. Options: (A) Expo with React Native Web (single codebase, all 3 platforms), (B) Next.js for web + Expo for mobile (two frontends, shared API).

**Decision:** Option B — separate frontends.

**Reasoning:**

- Web needs SSR for SEO (browse pages should be Google-indexable for organic growth)
- React Native Web produces suboptimal HTML/CSS — bad for SEO and accessibility
- Next.js gives us server components, API routes as a BFF (backend-for-frontend), and image optimization
- Mobile UX patterns (bottom tabs, swipe gestures, native maps) differ fundamentally from web
- Shared code lives in a `packages/shared` package: TypeScript types, API client, validation schemas

**Trade-offs:**

- (+) Best-in-class experience per platform
- (+) SEO for web
- (-) Two UI codebases to maintain (mitigated by shared types/logic/validation)
- (-) Slightly more initial setup

---

### ADR-003: Google OAuth with Domain Restriction + Phone Verification

**Status:** Recommended

**Context:**
Only UChicago students should access the platform. Need both identity verification (are you UChicago?) and contact verification (can we reach you?).

**Decision:** Two-step verification:

1. Google OAuth with `hd: "uchicago.edu"` parameter (restricts to UChicago Google Workspace)
2. Phone number + SMS verification via Twilio Verify after first OAuth login

**Flow:**

```
User clicks "Sign in with Google"
    → Google OAuth consent screen (only @uchicago.edu accounts)
    → Server validates `hd` claim = "uchicago.edu"
    → If new user: redirect to phone verification screen
        → User enters phone number
        → Twilio sends 6-digit code via SMS
        → User enters code
        → Server verifies via Twilio Verify API
        → Account created, JWT issued
    → If returning user: JWT issued, session starts
```

**Trade-offs:**

- (+) Google handles password security, MFA, account recovery
- (+) Domain restriction is enforced server-side (not just client hint)
- (+) Phone verification adds accountability (reduces fake accounts, spam)
- (-) Requires Twilio account ($0.05/verification — ~$350 for entire student body)
- (-) Students who don't have a phone number can't register (edge case)

---

### ADR-004: Monorepo with Turborepo

**Status:** Recommended

**Context:**
We have 3 deployable units (API, web, mobile) sharing TypeScript types, validation, and utilities. Need a strategy to keep them in sync.

**Decision:** pnpm monorepo with Turborepo for build orchestration.

**Structure:** (see Section 5 for full tree)

- `apps/api` — Express backend
- `apps/web` — Next.js frontend
- `apps/mobile` — Expo app
- `packages/shared` — Types, validation schemas, API client, constants

**Trade-offs:**

- (+) Single repo, single PR, types always in sync
- (+) Turborepo caches builds, parallelizes tasks
- (+) Shared validation (Zod schemas) between frontend and backend
- (-) Larger repo, slightly more complex CI
- (-) Learning curve for monorepo tooling

---

## 4. Database Schema

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    users      │     │     posts        │     │    reviews       │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (uuid) PK │◄────│ author_id FK     │     │ id (uuid) PK     │
│ email        │     │ id (uuid) PK     │◄────│ post_id FK       │
│ name         │     │ type (enum)      │     │ reviewer_id FK   │──► users
│ phone        │     │ side (enum)      │     │ reviewee_id FK   │──► users
│ avatar_url   │     │ status (enum)    │     │ rating (1-5)     │
│ is_verified  │     │ title            │     │ text             │
│ google_id    │     │ description      │     │ created_at       │
│ created_at   │     │ created_at       │     └──────────────────┘
│ updated_at   │     │ updated_at       │
└──────┬───────┘     │ expires_at       │     ┌──────────────────┐
       │             └────────┬─────────┘     │   messages       │
       │                      │               ├──────────────────┤
       │             ┌────────┴─────────┐     │ id (uuid) PK     │
       │             │                  │     │ conversation_id  │──► conversations
       │    ┌────────▼──────┐  ┌───────▼──────┐  │ sender_id FK │──► users
       │    │ mp_details    │  │ st_details   │  │ body           │
       │    ├───────────────┤  ├──────────────┤  │ created_at     │
       │    │ post_id FK    │  │ post_id FK   │  └──────────────────┘
       │    │ price_type    │  │ start_date   │
       │    │ price_amount  │  │ end_date     │  ┌──────────────────────────┐
       │    │ condition     │  │ size (enum)  │  │ conversations            │
       │    │ category      │  │ location_type│  ├──────────────────────────┤
       │    └───────────────┘  │ neighborhood │  │ id (uuid) PK             │
       │                       │ price_monthly│  │ post_id FK               │──► posts
       │    ┌──────────────┐   └──────────────┘  │ created_at               │
       │    │ post_images  │                     │ updated_at               │
       │    ├──────────────┤                     └──────────────────────────┘
       │    │ id (uuid) PK │
       │    │ post_id FK   │  ┌──────────────────────────┐
       │    │ url          │  │ conversation_participants │
       │    │ position     │  ├──────────────────────────┤
       │    │ created_at   │  │ conversation_id FK       │──► conversations
       │    └──────────────┘  │ user_id FK               │──► users
       │                      │ joined_at                │
       │    ┌──────────────┐  │ PK (conversation_id,     │
       │    │ saved_posts  │  │     user_id)             │
       │    ├──────────────┤  └──────────────────────────┘
       │    │ user_id FK   │──► users
       │    │ post_id FK   │──► posts
       │    │ created_at   │
       │    └──────────────┘
       │
       │    ┌──────────────────┐     ┌──────────────────┐
       ├───►│ notifications    │     │ refresh_tokens   │
       │    ├──────────────────┤     ├──────────────────┤
       │    │ id (uuid) PK     │     │ id (uuid) PK     │
       │    │ user_id FK       │     │ user_id FK       │──► users
       │    │ type (enum)      │     │ token_hash       │
       │    │ title            │     │ expires_at       │
       │    │ body             │     │ revoked_at       │
       │    │ link             │     │ created_at       │
       │    │ is_read          │     └──────────────────┘
       │    │ created_at       │
       │    └──────────────────┘
```

### Enums

```
post_type:      marketplace | storage
post_side:      sell | buy | has_space | need_storage
post_status:    active | sold | completed | expired | deleted
price_type:     fixed | free | trade
condition:      new | like_new | good | fair | for_parts | unknown
storage_size:   boxes | half_room | full_room
location_type:  on_campus | off_campus
notif_type:     message | review | save | match | expiring | system
```

---

## 5. Project Structure (Monorepo)

```
uchicago-marketplace/
├── apps/
│   ├── api/                          # Express backend (deploys to Railway)
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point, server setup
│   │   │   ├── config/
│   │   │   │   ├── env.ts            # Environment variable validation (Zod)
│   │   │   │   ├── database.ts       # Prisma client singleton
│   │   │   │   ├── redis.ts          # Redis client singleton (rate limiting)
│   │   │   │   └── auth.ts           # Google OAuth + JWT config
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # JWT verification middleware
│   │   │   │   ├── validate.ts       # Zod request validation middleware
│   │   │   │   ├── rateLimit.ts      # Rate limiting
│   │   │   │   └── errorHandler.ts   # Global error handler
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts           # POST /auth/google, POST /auth/verify-phone
│   │   │   │   ├── posts.ts          # CRUD for all post types
│   │   │   │   ├── users.ts          # GET /users/:id, PATCH /users/me
│   │   │   │   ├── reviews.ts        # POST /reviews, GET /users/:id/reviews
│   │   │   │   ├── messages.ts       # Conversations and messages
│   │   │   │   ├── notifications.ts  # GET /notifications, PATCH read status
│   │   │   │   ├── saved.ts          # Save/unsave posts
│   │   │   │   └── upload.ts         # Image upload to Cloudinary
│   │   │   ├── services/             # Business logic layer
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── post.service.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── review.service.ts
│   │   │   │   ├── message.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   └── match.service.ts  # Storage matching logic
│   │   │   └── socket/
│   │   │       └── index.ts          # Socket.IO setup for messaging + notifications
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Database schema
│   │   │   └── seed.ts               # Seed data for development
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                          # Next.js frontend (deploys to Vercel or Railway)
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── layout.tsx        # Root layout (navbar, providers)
│   │   │   │   ├── page.tsx          # Home page (hero + feature tabs)
│   │   │   │   ├── browse/
│   │   │   │   │   └── page.tsx      # Browse with filters (server component + client filters)
│   │   │   │   ├── post/[id]/
│   │   │   │   │   └── page.tsx      # Post detail (SSR for SEO)
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx      # Create post form
│   │   │   │   ├── profile/[id]/
│   │   │   │   │   └── page.tsx      # User profile
│   │   │   │   ├── notifications/
│   │   │   │   │   └── page.tsx      # Notifications feed
│   │   │   │   ├── messages/
│   │   │   │   │   └── page.tsx      # Conversations list + chat
│   │   │   │   └── auth/
│   │   │   │       ├── callback/page.tsx  # Google OAuth callback
│   │   │   │       └── verify/page.tsx    # Phone verification step
│   │   │   ├── components/
│   │   │   │   ├── layout/           # Navbar, Footer, Sidebar
│   │   │   │   ├── posts/            # PostCard, PostGrid, PostDetail
│   │   │   │   ├── forms/            # CreatePostForm, FilterForm
│   │   │   │   ├── auth/             # LoginButton, PhoneVerify
│   │   │   │   ├── profile/          # ProfileHeader, ReviewCard
│   │   │   │   ├── messaging/        # ChatWindow, ConversationList
│   │   │   │   └── ui/              # Badge, Button, Modal, Tabs (design system)
│   │   │   ├── hooks/                # useAuth, usePosts, useSocket, etc.
│   │   │   ├── lib/
│   │   │   │   ├── api.ts            # API client (wraps shared client with Next.js specifics)
│   │   │   │   └── auth.ts           # Auth context provider
│   │   │   └── styles/
│   │   │       └── globals.css       # Tailwind CSS + design tokens
│   │   ├── public/
│   │   │   ├── wing.svg
│   │   │   └── phoenix.png
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── mobile/                       # Expo (React Native) app
│       ├── app/                      # Expo Router (file-based routing)
│       │   ├── _layout.tsx           # Root layout (tab navigator)
│       │   ├── (tabs)/
│       │   │   ├── index.tsx         # Home / browse feed
│       │   │   ├── search.tsx        # Search + filters
│       │   │   ├── create.tsx        # Create post
│       │   │   ├── messages.tsx      # Conversations
│       │   │   └── profile.tsx       # My profile
│       │   ├── post/[id].tsx         # Post detail
│       │   ├── user/[id].tsx         # Other user's profile
│       │   ├── auth/
│       │   │   ├── login.tsx         # Google sign-in
│       │   │   └── verify.tsx        # Phone verification
│       │   └── notifications.tsx
│       ├── components/               # Mobile-specific components
│       │   ├── PostCard.tsx
│       │   ├── FilterSheet.tsx       # Bottom sheet filters
│       │   ├── ChatBubble.tsx
│       │   └── ...
│       ├── hooks/                    # Mobile-specific hooks
│       ├── package.json
│       ├── app.json                  # Expo config
│       └── tsconfig.json
│
├── packages/
│   └── shared/                       # Shared between all apps
│       ├── src/
│       │   ├── types/                # TypeScript interfaces
│       │   │   ├── user.ts
│       │   │   ├── post.ts           # Post, MarketplaceDetails, StorageDetails, etc.
│       │   │   ├── review.ts
│       │   │   ├── message.ts
│       │   │   └── notification.ts
│       │   ├── schemas/              # Zod validation schemas
│       │   │   ├── post.schema.ts    # CreatePostSchema, UpdatePostSchema, etc.
│       │   │   ├── auth.schema.ts    # PhoneVerifySchema
│       │   │   └── review.schema.ts
│       │   ├── constants/
│       │   │   ├── categories.ts     # Post categories, conditions, neighborhoods, etc.
│       │   │   └── config.ts         # Feature flags, limits
│       │   ├── api-client/           # Typed API client (fetch-based, works in any JS env)
│       │   │   ├── client.ts         # Base client with auth headers
│       │   │   ├── posts.ts          # getPosts, getPost, createPost, etc.
│       │   │   ├── auth.ts           # login, verifyPhone
│       │   │   └── index.ts          # Barrel export
│       │   └── utils/
│       │       ├── formatters.ts     # Price formatting, date formatting, etc.
│       │       └── validators.ts     # Email domain check, phone format, etc.
│       ├── package.json
│       └── tsconfig.json
│
├── planning/                         # This document
│   └── implementation.md
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml               # Monorepo workspace config
├── package.json                      # Root package.json
├── .gitignore
├── .env.example                      # Template for environment variables
└── README.md
```

---

## 6. API Design

### Authentication

```
POST   /api/auth/google          # Exchange Google auth code for JWT
POST   /api/auth/verify-phone    # Submit phone + verification code
POST   /api/auth/refresh         # Refresh JWT token
POST   /api/auth/logout          # Invalidate refresh token
```

### Posts (polymorphic — handles both feature types)

```
GET    /api/posts                # List posts (filterable by type, side, category, etc.)
GET    /api/posts/:id            # Get single post with details
POST   /api/posts                # Create post (type determines required fields)
PATCH  /api/posts/:id            # Update post
DELETE /api/posts/:id            # Soft delete post
PATCH  /api/posts/:id/status     # Mark as sold/completed/expired
```

**Query parameters for GET /api/posts:**

```
?type=marketplace|storage
&side=sell|buy|has_space|need_storage
&q=search+terms                    (full-text search)
&category=textbooks                (marketplace only)
&size=boxes|half_room|full_room    (storage only)
&location=on_campus|off_campus     (storage only)
&price_min=0&price_max=100
&condition=new|like_new|good|fair
&sort=recent|price_asc|price_desc|relevance
&page=1&limit=20
```

### Users

```
GET    /api/users/:id            # Public profile
PATCH  /api/users/me             # Update own profile
GET    /api/users/me/posts       # My posts (all types)
```

### Reviews

```
POST   /api/reviews              # Leave a review for a user (linked to a post/transaction)
GET    /api/users/:id/reviews    # Reviews for a user
```

### Messages

```
GET    /api/conversations              # List my conversations
GET    /api/conversations/:id/messages # Messages in a conversation
POST   /api/conversations              # Start new conversation (about a post)
POST   /api/conversations/:id/messages # Send message
```

### Saved Posts

```
GET    /api/saved                 # My saved posts
POST   /api/saved/:postId        # Save a post
DELETE /api/saved/:postId        # Unsave a post
```

### Notifications

```
GET    /api/notifications         # My notifications
PATCH  /api/notifications/:id     # Mark as read
PATCH  /api/notifications/read-all # Mark all as read
```

### Images

```
POST   /api/upload               # Upload image to Cloudinary, return URL
```

---

## 7. Authentication Flow (Detailed)

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌────────┐     ┌────────┐
│  Client  │     │  Google  │     │  Express API │     │ Prisma │     │ Twilio │
└────┬─────┘     └────┬────┘     └──────┬───────┘     └───┬────┘     └───┬────┘
     │                │                  │                 │              │
     │  1. Click      │                  │                 │              │
     │  "Sign in      │                  │                 │              │
     │   with Google" │                  │                 │              │
     │───────────────►│                  │                 │              │
     │                │                  │                 │              │
     │  2. OAuth      │                  │                 │              │
     │  consent       │                  │                 │              │
     │  (hd=uchicago  │                  │                 │              │
     │   .edu)        │                  │                 │              │
     │◄───────────────│                  │                 │              │
     │                │                  │                 │              │
     │  3. Auth code  │                  │                 │              │
     │────────────────┼─────────────────►│                 │              │
     │                │                  │                 │              │
     │                │  4. Exchange     │                 │              │
     │                │  code for token  │                 │              │
     │                │◄─────────────────│                 │              │
     │                │                  │                 │              │
     │                │  5. Return       │                 │              │
     │                │  user info       │                 │              │
     │                │─────────────────►│                 │              │
     │                │                  │                 │              │
     │                │                  │  6. Validate    │              │
     │                │                  │  hd=uchicago.edu│              │
     │                │                  │  (server-side)  │              │
     │                │                  │                 │              │
     │                │                  │  7. Lookup/     │              │
     │                │                  │  create user    │              │
     │                │                  │────────────────►│              │
     │                │                  │◄────────────────│              │
     │                │                  │                 │              │
     │  8a. If new user: need phone      │                 │              │
     │◄──────────────────────────────────│                 │              │
     │                                   │                 │              │
     │  9. Submit phone number           │                 │              │
     │──────────────────────────────────►│                 │              │
     │                                   │  10. Send SMS   │              │
     │                                   │────────────────────────────────►
     │                                   │◄────────────────────────────────
     │  11. Enter 6-digit code           │                 │              │
     │──────────────────────────────────►│                 │              │
     │                                   │  12. Verify     │              │
     │                                   │────────────────────────────────►
     │                                   │◄────────────────────────────────
     │                                   │                 │              │
     │                                   │  13. Mark       │              │
     │                                   │  verified       │              │
     │                                   │────────────────►│              │
     │                                   │                 │              │
     │  14. JWT (access + refresh)       │                 │              │
     │◄──────────────────────────────────│                 │              │
     │                                   │                 │              │
     │  8b. If returning user: JWT       │                 │              │
     │◄──────────────────────────────────│                 │              │
```

**Security details:**

- Google OAuth `hd` parameter restricts consent screen to `@uchicago.edu` accounts
- Server **re-validates** the `hd` claim in the ID token (never trust client-only checks)
- JWT access tokens: 15 min expiry, stored in memory (web) or secure storage (mobile)
- JWT refresh tokens: 7 day expiry, stored in httpOnly cookie (web) or secure storage (mobile)
- **Refresh token revocation:** refresh tokens are hashed and stored in `refresh_tokens` table. On `/auth/refresh`, server checks the token exists, is not revoked, and hasn't expired. On `/auth/logout`, the token's `revoked_at` is set. On account compromise, all tokens for the user are deleted (force logout on all devices).
- Phone verification is one-time; verified flag stored in DB
- **Rate limiting (Redis-backed):** `/auth/google` — 10 req/min per IP; `/auth/verify-phone` — 3 req/min per IP, 5 req/hr per phone number. Prevents OTP brute-force and Twilio cost inflation.

---

## 8. Implementation Phases

### Phase 0: Project Scaffold (Est. 2-3 days)

**Goal:** Set up monorepo, tooling, and deploy empty shells to Railway.

| #   | Task                         | Details                                                                |
| --- | ---------------------------- | ---------------------------------------------------------------------- |
| 0.1 | Init monorepo                | pnpm workspace, Turborepo, root tsconfig                               |
| 0.2 | Create `packages/shared`     | Types, Zod schemas, constants, API client stub                         |
| 0.3 | Create `apps/api`            | Express + TypeScript, Prisma setup, health check endpoint              |
| 0.4 | Create `apps/web`            | Next.js 14 App Router, Tailwind CSS with UChicago design tokens        |
| 0.5 | Create `apps/mobile`         | Expo with Expo Router, basic tab navigation                            |
| 0.6 | Set up PostgreSQL on Railway | Create instance, connect Prisma, run first migration                   |
| 0.7 | Set up Redis on Railway      | Create Redis instance, configure `rate-limit-redis` + `ioredis` client |
| 0.8 | Deploy API to Railway        | Dockerfile or Nixpacks, env vars configured                            |
| 0.9 | CI/CD                        | GitHub Actions: lint + type-check + test on PR                         |

**Checkpoint:** Empty apps running — API returns `{ status: "ok" }`, web shows a page, mobile shows tabs.

---

### Phase 1: Auth & User System (Est. 3-4 days)

**Goal:** Users can sign in with Google (@uchicago.edu), verify phone, and see their profile.

| #    | Task                                              | Details                                                                                      |
| ---- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1.1  | DB: User model + refresh_tokens table + migration | Prisma schema, `users` and `refresh_tokens` tables                                           |
| 1.2  | API: Google OAuth endpoint                        | Exchange code, validate `hd`, issue JWT                                                      |
| 1.3  | API: Refresh token revocation                     | Store hashed refresh tokens in DB, revoke on logout, delete all on compromise                |
| 1.4  | API: Phone verification                           | Twilio Verify integration                                                                    |
| 1.5  | API: Auth middleware                              | JWT validation, attach user to request                                                       |
| 1.6  | API: Redis rate limiting on auth routes           | `/auth/google` 10 req/min per IP, `/auth/verify-phone` 3 req/min per IP + 5 req/hr per phone |
| 1.7  | API: User endpoints                               | GET /users/:id, PATCH /users/me                                                              |
| 1.8  | Shared: Auth types + schemas                      | User type, auth schemas, API client methods                                                  |
| 1.9  | Web: Google sign-in button                        | OAuth redirect, callback page                                                                |
| 1.10 | Web: Phone verification page                      | OTP input, verification flow                                                                 |
| 1.11 | Web: Auth context + navbar                        | Login state, protected routes                                                                |
| 1.12 | Mobile: Google sign-in                            | Expo AuthSession, secure token storage                                                       |
| 1.13 | Mobile: Phone verification                        | Same flow, mobile UI                                                                         |

**Checkpoint:** Users can sign in on web and mobile, verify phone, see logged-in navbar.

---

### Phase 2: Posts CRUD (Est. 4-5 days)

**Goal:** Users can create, browse, and view both post types (marketplace + storage) with real data.

| #    | Task                         | Details                                                   |
| ---- | ---------------------------- | --------------------------------------------------------- |
| 2.1  | DB: Posts schema + migration | `posts`, `mp_details`, `st_details`, `post_images` tables |
| 2.2  | API: Create post endpoint    | Polymorphic creation (type determines required fields)    |
| 2.3  | API: List posts endpoint     | Filtering, pagination, full-text search                   |
| 2.4  | API: Get post detail         | Join with type-specific details + author info             |
| 2.5  | API: Update/delete post      | Owner-only, soft delete                                   |
| 2.6  | API: Image upload            | Cloudinary integration, return URLs                       |
| 2.7  | Shared: Post types + schemas | Zod schemas for create/update per type                    |
| 2.8  | Web: Create post form        | Feature type selector, dynamic fields per type            |
| 2.9  | Web: Browse page             | Server-side initial load, client-side filtering           |
| 2.10 | Web: Post detail page        | SSR, type-specific layout                                 |
| 2.11 | Web: Home page               | Feature tabs, recent posts from API                       |
| 2.12 | Mobile: Create post          | Multi-step form with image picker                         |
| 2.13 | Mobile: Browse feed          | Infinite scroll, pull-to-refresh                          |
| 2.14 | Mobile: Post detail          | Type-specific layout                                      |

**Checkpoint:** Full post lifecycle works — create, browse, view, edit, delete on both platforms.

---

### Phase 3: Social Features (Est. 3-4 days)

**Goal:** Reviews, saved posts, user profiles with history.

| #   | Task                             | Details                                            |
| --- | -------------------------------- | -------------------------------------------------- |
| 3.1 | DB: Reviews + saved_posts tables | Migration                                          |
| 3.2 | API: Review endpoints            | Create review, get user reviews, calculate average |
| 3.3 | API: Saved post endpoints        | Save/unsave/list                                   |
| 3.4 | API: Profile endpoint            | Aggregate user data (posts, reviews, stats)        |
| 3.5 | Web: Profile page                | Header, reviews, active posts tabs                 |
| 3.6 | Web: Save button + saved list    | Toggle save, saved posts page                      |
| 3.7 | Web: Review form                 | Post-transaction review flow                       |
| 3.8 | Mobile: Profile screen           | Same features, mobile layout                       |
| 3.9 | Mobile: Save + review            | Mobile UX                                          |

**Checkpoint:** Full social features — profiles with reviews, save/unsave posts.

---

### Phase 4: Messaging & Notifications (Est. 4-5 days)

**Goal:** Users can message each other about posts and receive notifications.

| #    | Task                                                                            | Details                                                       |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 4.1  | DB: Conversations + conversation_participants + messages + notifications tables | Migration (uses join table for flexible participant model)    |
| 4.2  | API: Messaging endpoints                                                        | REST for history, Socket.IO for real-time                     |
| 4.3  | API: Socket.IO setup                                                            | Auth'd WebSocket connections, rooms per conversation          |
| 4.4  | API: Notification service                                                       | Create notifications on events (message, review, save, match) |
| 4.5  | API: Notification endpoints                                                     | List, mark read, mark all read                                |
| 4.6  | API: Push notifications                                                         | Firebase Cloud Messaging integration                          |
| 4.7  | Web: Chat interface                                                             | Conversation list, message thread, real-time updates          |
| 4.8  | Web: Notification bell + page                                                   | Unread count badge, notification feed                         |
| 4.9  | Mobile: Chat                                                                    | Real-time messaging, push notifications                       |
| 4.10 | Mobile: Notifications                                                           | Push + in-app notification feed                               |

**Checkpoint:** Users can message each other in real-time, receive push notifications on mobile.

---

### Phase 5: Polish & Launch (Est. 2-3 days)

**Goal:** Production readiness.

| #    | Task                      | Details                                                                                              |
| ---- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| 5.1  | Post status management    | Mark sold/completed/expired, auto-expire old posts                                                   |
| 5.2  | Report system             | Report posts, basic moderation queue                                                                 |
| 5.3  | Storage match suggestions | Notify users when a matching storage post appears                                                    |
| 5.4  | Web: SEO                  | Meta tags, Open Graph, structured data for post pages                                                |
| 5.5  | Web: Performance          | Image optimization, code splitting, caching headers                                                  |
| 5.6  | Mobile: App Store prep    | Icons, splash screens, screenshots, store listings                                                   |
| 5.7  | General API rate limiting | Extend Redis rate limiting to all endpoints (auth routes already covered in Phase 1), spam detection |
| 5.8  | Monitoring                | Error tracking (Sentry free tier), basic logging                                                     |
| 5.9  | Seed data                 | Realistic demo data for launch                                                                       |
| 5.10 | Deploy production         | Railway production env, custom domain                                                                |

**Checkpoint:** Production launch.

---

## 9. Technology Stack Summary

| Layer              | Choice                    | Cost                               | Justification                                               |
| ------------------ | ------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| **Web frontend**   | Next.js 14 + Tailwind CSS | Free (Vercel free tier or Railway) | SSR for SEO, React ecosystem                                |
| **Mobile**         | Expo (React Native)       | Free                               | Single codebase for iOS + Android, OTA updates              |
| **Backend**        | Express.js + TypeScript   | Free (Railway starter)             | Lightweight, large ecosystem                                |
| **Database**       | PostgreSQL                | Free (Railway 500MB free)          | Relational data, full-text search                           |
| **ORM**            | Prisma                    | Free                               | Type-safe, great DX, auto migrations                        |
| **Auth**           | Google OAuth + JWT        | Free                               | UChicago Google Workspace                                   |
| **Phone verify**   | Twilio Verify             | ~$0.05/verify                      | Purpose-built, reliable                                     |
| **Images**         | Cloudinary                | Free (25GB/25K transforms)         | CDN, auto-optimization                                      |
| **Real-time**      | Socket.IO                 | Free                               | Messaging + notifications                                   |
| **Rate Limiting**  | Redis on Railway          | Free (Railway add-on)              | Distributed rate limiting, also usable as Socket.IO adapter |
| **Push**           | Firebase Cloud Messaging  | Free                               | iOS + Android + web push                                    |
| **Monorepo**       | Turborepo + pnpm          | Free                               | Build caching, workspace management                         |
| **CI/CD**          | GitHub Actions            | Free (public repo)                 | Lint, typecheck, test on PR                                 |
| **Error tracking** | Sentry                    | Free (5K events/mo)                | Error monitoring                                            |

**Estimated monthly cost at launch:** $0-5/month (Railway hobby plan if free tier exceeded)

---

## 10. Risks & Mitigations

| Risk                                     | Likelihood | Impact | Mitigation                                                             |
| ---------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------- |
| Google OAuth domain restriction bypassed | Low        | High   | Server-side `hd` claim validation, not just client hint                |
| Railway free tier insufficient           | Medium     | Low    | Upgrade to $5/mo hobby plan; PostgreSQL scales well for this user base |
| Cloudinary free tier exceeded            | Low        | Low    | Compress images client-side before upload; lazy-load on browse         |
| Twilio costs during mass signup          | Low        | Low    | Rate limit verifications per IP; bulk pricing available                |
| Mobile app store rejection               | Medium     | Medium | Follow Apple/Google guidelines; no prohibited content categories       |
| Scope creep beyond MVP                   | High       | Medium | Strict phase gating; ship Phase 0-2 first, iterate                     |
| Socket.IO scaling past 1 server          | Low        | Medium | Railway supports multiple instances; Redis adapter if needed           |

---

## 11. Migration Strategy (Current Prototype → New Architecture)

The existing HTML/CSS prototype is **not carried forward as code** — it serves as the **design specification**. Here's what we preserve:

| From Prototype                                                  | Carried To                                            |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| CSS variables (maroon, amber palettes)                          | Tailwind CSS theme config (`tailwind.config.ts`)      |
| Component designs (cards, badges, forms)                        | React components with same visual output              |
| Page layouts (browse, create, post, profile)                    | Next.js pages / Expo screens                          |
| Feature taxonomy (2 types: marketplace + storage, 2 sides each) | Database enums + shared constants                     |
| UX flows (tab switching, filter behavior)                       | Client-side state management                          |
| Assets (wing.svg, phoenix.png)                                  | Moved to `apps/web/public/` and `apps/mobile/assets/` |

**The old static HTML files will be removed** after the new web app reaches feature parity (end of Phase 2).

---

## 12. Environment Variables

```env
# apps/api/.env
DATABASE_URL=postgresql://user:pass@host:5432/uchicago_marketplace
REDIS_URL=redis://default:pass@host:6379
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_VERIFY_SERVICE_SID=xxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
FIREBASE_SERVICE_ACCOUNT=xxx  # base64 encoded JSON
ALLOWED_EMAIL_DOMAIN=uchicago.edu
NODE_ENV=production
PORT=3000

# apps/web/.env.local
NEXT_PUBLIC_API_URL=https://api.uchicagomarketplace.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
NEXT_PUBLIC_SOCKET_URL=wss://api.uchicagomarketplace.com

# apps/mobile (app.json extras or .env via expo-constants)
API_URL=https://api.uchicagomarketplace.com
GOOGLE_CLIENT_ID_IOS=xxx
GOOGLE_CLIENT_ID_ANDROID=xxx
```

---

## Next Steps

**Review this document.** When you're ready, signal and I will begin implementation starting with Phase 0 (project scaffold).

Questions to resolve before starting:

1. Do you have a Google Cloud project set up for OAuth credentials? (needed for Phase 1)
2. Do you have a Twilio account? (needed for Phase 1)
3. Do you have a Cloudinary account? (needed for Phase 2)
4. Railway account? (needed for Phase 0)
5. Apple Developer account ($99/year) for iOS App Store? (needed for Phase 5)

---

### Future TODOs (from Phase 2 Mobile)

- [ ] **Mobile-specific API layer**: Evaluate building a wrapper on top of the shared `ApiClient` for offline caching, retry on flaky WiFi, and optimistic updates
- [ ] **Web: migrate to shared ApiClient**: Web app uses raw `fetch` with duplicated `API_URL` + auth header patterns across 6+ files — should use `createApi()` from `@uchicago-marketplace/shared` for consistency
- [ ] **Date pickers**: Replace plain text date inputs in create wizard with proper native date pickers (`@react-native-community/datetimepicker` or similar)
- [ ] **Star ratings API**: Build ratings system so AuthorRow can display real ratings instead of being omitted
- [ ] **Edit/delete from mobile**: Wire up edit form and delete confirmation from the post detail overflow menu
- [ ] **Housing: web support**: Add housing type support to the web app's browse/create/detail/edit pages
