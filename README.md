# UChicago E-mart

> The student-only marketplace for UChicago — buy, sell, find housing, and connect with Maroons you can actually trust.

**Live at:** [uchicagoemart.com](https://www.uchicagoemart.com)

Hey! 👋 UChicago E-mart is a marketplace built by and for UChicago students. Every user signs in with their `@uchicago.edu` email, so you know you're trading with real classmates — no randoms, no sketchy DMs, no Facebook group chaos. Whether you're offloading a fourth-year's worth of furniture before graduation, hunting for a Hyde Park sublet, or picking up a textbook for half what the bookstore charges, this is the place.

## What you can do

- **Marketplace** — buy and sell textbooks, furniture, electronics, lab gear, clothing, and whatever else UChicago students actually own. List in under a minute with photos.
- **Housing** — find sublets and lease passdowns with real, verified addresses (every listing is checked against Google Maps, so what you see on the pin is where you'll actually live). Browse listings as a list or on an interactive map.
- **Storage Match** — got empty space over the summer? Need somewhere to stash your stuff while you're back home? Match with another student instead of paying for a storage unit.

Everything is filtered by category, price, condition, and location. You can save listings, message sellers directly, and leave reviews after transactions.

## Tech stack

This is a pnpm + Turborepo monorepo with three apps and a shared package:

```
apps/
├── api/         Express + Prisma + Postgres backend
├── web/         Next.js 16 + React 19 + Tailwind v4 frontend
└── mobile/      React Native app (in progress)

packages/
└── shared/      Zod schemas, types, and constants shared across apps
```

**Key technologies:**
- **Frontend:** Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript
- **Backend:** Express, Prisma ORM, PostgreSQL, Socket.IO for real-time messaging
- **Auth:** Firebase Admin SDK + Google OAuth + JWT (uchicago.edu email required)
- **Storage:** Firebase Storage for image uploads, Sharp for image processing
- **Maps:** Google Maps JavaScript API + Places API for address verification
- **Testing:** Vitest for backend unit tests
- **Deployment:** Railway (Docker), one service per app

## Getting started

You'll need:

- **Node.js 22+** and **pnpm 10.33+**
- **PostgreSQL** running locally (or a connection string to a hosted instance)
- A few API keys (Google OAuth, Firebase, Google Maps — see [.env.example](.env.example) files)

```bash
# Clone and install
git clone https://github.com/alnosarus/uchicago_emart.git
cd uchicago_emart
pnpm install

# Copy the example env files and fill in your keys
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Run the database migration
pnpm db:migrate

# Start everything (API on :3000, web on :3001)
./dev.sh
```

Then open **http://localhost:3001** and sign in with your `@uchicago.edu` email.

## Project scripts

From the project root:

| Command | What it does |
|---|---|
| `pnpm dev` | Run all dev servers in parallel via Turbo |
| `./dev.sh` | Same as above but with clean shutdown and port cleanup |
| `pnpm dev:api` | Just the API (`apps/api`) on port 3000 |
| `pnpm dev:web` | Just the web app (`apps/web`) on port 3001 |
| `pnpm dev:mobile` | Just the mobile app (`apps/mobile`) |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm db:migrate` | Run Prisma dev migrations |
| `pnpm db:seed` | Seed the database with sample data |
| `pnpm db:studio` | Open Prisma Studio (database GUI) |

API-specific (run from `apps/api/`):

| Command | What it does |
|---|---|
| `pnpm test` | Run Vitest backend tests |
| `pnpm test:watch` | Run tests in watch mode |

## Repo layout highlights

```
apps/
├── api/
│   ├── src/
│   │   ├── routes/              Express routes (auth, posts, messages, etc.)
│   │   ├── services/            Business logic (posts, geocoding, uploads, ...)
│   │   ├── middleware/          Auth, validation, error handling
│   │   ├── config/              Env validation, database, Firebase setup
│   │   └── socket/              Socket.IO server for real-time messaging
│   └── prisma/
│       ├── schema.prisma        Database schema
│       └── migrations/          Migration history
│
├── web/
│   └── src/
│       ├── app/                 Next.js App Router pages
│       │   ├── create/          Create a new post
│       │   ├── browse/          Browse & filter listings
│       │   ├── posts/[id]/      Post detail page
│       │   └── profile/[id]/    User profile page
│       ├── components/
│       │   ├── housing/         Google Maps components (address verification)
│       │   └── ...              Shared UI components
│       └── lib/                 Auth context, socket context, Firebase client
│
└── mobile/                      React Native app (early stage)

packages/shared/
└── src/
    ├── schemas/                 Zod schemas for requests/responses
    ├── types/                   TypeScript types
    └── constants/               Categories, amenities, options

docs/
└── superpowers/
    ├── specs/                   Design documents for major features
    └── plans/                   Implementation plans
```

## Contributing

This is currently a solo project, but if you're a UChicago student who wants to help out, open an issue or reach out. PRs are welcome.

A few conventions we follow:

- **Commit messages:** `type(scope): message` (e.g., `feat(api): add search endpoint`)
- **Feature work:** branch → spec in `docs/superpowers/specs/` → plan in `docs/superpowers/plans/` → implement → merge
- **Testing:** backend logic gets Vitest unit tests; frontend uses typecheck + manual QA
- **Schemas first:** all request/response shapes live in `packages/shared` as Zod schemas so the API and web app agree on types

## Questions?

- **Bug or feature request:** open an issue
- **Anything else:** reach out on campus or via the contact info on the site

---

Built with ☕ in Hyde Park.
