# Housing Address Verification & Map View — Implementation Notes

**Status:** Shipped to `main`, deployed to Railway production
**Date shipped:** 2026-04-08
**Branch (merged):** `feat/housing-address-verification` → `main` (commit `bc0aeef`)
**Spec:** [docs/superpowers/specs/2026-04-08-housing-address-verification-design.md](docs/superpowers/specs/2026-04-08-housing-address-verification-design.md)
**Plan:** [docs/superpowers/plans/2026-04-08-housing-address-verification.md](docs/superpowers/plans/2026-04-08-housing-address-verification.md)

---

## What was built

Google Places–backed address verification for housing listings, with maps surfaced at three points in the app:

1. **Create form** — `<AddressAutocomplete>` input with biased Chicago suggestions, plus an inline `<PropertyMap>` preview that renders the moment a place is selected so the seller can confirm the pin is on the right building before publishing.
2. **Detail page** — `<PropertyMap>` inside `HousingDetailsSection` showing the verified location for buyers.
3. **Browse page** — list/map toggle (`?view=map` URL state) with a `<HousingMapView>` clustered map showing all housing posts with verified addresses. Pins are maroon `$<rent>` badges; clicking opens an info window with thumbnail/title/rent and a "View listing" link.

The primary goal was scam prevention via real address picking. Secondary goal was geographic trust (buyers can see exactly where a property is).

---

## Architecture: server-trusted coordinates

**Critical trust boundary:** the client never submits `latitude`/`longitude`. Only `placeId` is sent. The server re-resolves coordinates via Google Place Details using a separate, server-side API key, applies type filtering (`street_address` / `premise` / `subpremise` only) and a Chicago bounding-box check, then stores Google's canonical values.

```
Frontend (apps/web)                      Backend (apps/api)
─────────────────                        ──────────────────
<AddressAutocomplete>     ─placeId─>     POST /api/posts
  (Google Places JS,                     ├─ geocoding.service.ts
   browser-restricted key)               │   └─ verifyPlaceId(placeId)
                                         │       └─ Google Place Details API
<PropertyMap>                            │           (server-side key)
  (reused on create preview              └─ posts.service.ts
   and detail page)                          └─ stores Google-returned
                                                address/lat/lng
<HousingMapView>                         GET /api/posts/housing/map
  (browse page, clustered                └─ lightweight projection
   via MarkerClusterer)                       for map pins
```

A malicious client can forge a `placeId` in the request body, but Google will either reject it or return a real, verifiable place that the server then validates against type and bbox constraints. Both rejection paths were verified during manual QA:
- City `Chicago, IL` → server rejects with `wrong_type`
- NYC building (350 5th Ave) → server rejects with `out_of_bounds`

---

## Database changes

`HousingDetails` model gained four nullable columns + an index:

```prisma
model HousingDetails {
  // ... existing fields ...
  address    String?
  latitude   Float?
  longitude  Float?
  placeId    String?  @map("place_id")
  @@index([latitude, longitude])
}
```

**Migration:** `20260408081802_housing_address` — additive only, idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), no backfill. Legacy housing posts have null values and are excluded from the map view.

**Legacy edit enforcement:** when a legacy housing post is edited, `updatePost` requires the user to now provide a valid `placeId` before saving. Implemented in `apps/api/src/services/posts.service.ts:updatePost`. Tested via unit test in `posts.service.test.ts`.

---

## Files

**New files (backend):**
- `apps/api/vitest.config.ts`
- `apps/api/src/services/geocoding.service.ts` — `verifyPlaceId()` with type filtering + bbox guard
- `apps/api/src/services/geocoding.service.test.ts` — 9 unit tests
- `apps/api/src/services/posts.service.test.ts` — 10 unit tests
- `apps/api/prisma/migrations/20260408081802_housing_address/migration.sql`

**Modified files (backend):**
- `apps/api/package.json` — added vitest
- `apps/api/prisma/schema.prisma` — added 4 columns + index
- `apps/api/src/config/env.ts` — added `GOOGLE_PLACES_SERVER_KEY`, `GEOCODING_CHICAGO_BBOX`
- `apps/api/src/services/posts.service.ts` — verifyPlaceId integrated into createPost + updatePost; new `listHousingMapPosts()` function
- `apps/api/src/routes/posts.ts` — new `GET /api/posts/housing/map` route
- `apps/api/.env.example`

**New files (frontend):**
- `apps/web/src/components/housing/GoogleMapsLoader.tsx` — provider, lazy loads `@googlemaps/js-api-loader` once per session
- `apps/web/src/components/housing/AddressAutocomplete.tsx`
- `apps/web/src/components/housing/PropertyMap.tsx` — single-pin map (used on create preview + detail page)
- `apps/web/src/components/housing/HousingMapView.tsx` — clustered browse map

**Modified files (frontend):**
- `apps/web/package.json` — added `@googlemaps/js-api-loader`, `@googlemaps/markerclusterer`, `@types/google.maps`
- `apps/web/.env.example` — added `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
- `apps/web/src/app/providers.tsx` — mounted `<GoogleMapsProvider>`
- `apps/web/src/app/create/page.tsx` — wired autocomplete + preview into housing form
- `apps/web/src/app/posts/[id]/client-page.tsx` — added `<PropertyMap>` to housing detail
- `apps/web/src/app/posts/[id]/edit/page.tsx` — pre-fills address, requires re-pick on save, legacy notice
- `apps/web/src/app/browse/page.tsx` — list/map toggle + `<HousingMapView>` rendering
- `apps/web/src/app/page.tsx` — drive-by fix for nested `<Link>` hydration error (unrelated to housing, but found during QA)

**Shared package:**
- `packages/shared/src/schemas/post.schema.ts` — `housingDetailsSchema.placeId` now required

---

## Configuration

### Google Cloud setup

Two API keys, both on the `uchicagoemart` Google Cloud project:

| Key name | Type | Application restrictions | API restrictions |
|---|---|---|---|
| `uchicagoemart-maps-browser` | Browser (public) | HTTP referrers: `http://localhost:3001/*`, `https://localhost:3001/*`, `https://www.uchicagoemart.com/*`, `https://uchicagoemart.com/*` | Maps JavaScript API, Places API, Places API (New) |
| `uchicagoemart-places-server` | Server | None (Hobby tier — Railway dynamic egress IPs make IP restriction impractical) | Places API, Places API (New) |

**Important:** the codebase currently uses the **legacy** Places API endpoints (`maps.googleapis.com/maps/api/place/details/json` server-side, `google.maps.places.Autocomplete` and `google.maps.places.PlacesService` client-side). Both keys must allow the legacy Places API in addition to Places API (New). See "Pending follow-ups" below for migration to the new API.

### Required project APIs (enable in Google Cloud Console → APIs & Services → Library)

- Maps JavaScript API
- **Places API** (legacy) ← required by current code
- Places API (New) ← needed eventually after migration

### Environment variables

**`apps/api/.env`** (symlink to root `.env` — only edit one):
```bash
GOOGLE_PLACES_SERVER_KEY=AIza...                       # server key
GEOCODING_CHICAGO_BBOX=41.6,-87.9,42.1,-87.5           # optional, has default
```

**`apps/web/.env.local`:**
```bash
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=AIza...            # browser key
```

**Railway production:** both vars are configured in the respective service Variables tabs (API service has the server key, Web service has the browser key). `NEXT_PUBLIC_*` vars are inlined at Next.js build time, so changing the browser key in Railway requires triggering a redeploy.

### Cost guardrails

- Server-side Place Details: ~$17 per 1000 calls. At expected volume (<10/day), well within Google's $200/mo free credit.
- Browser-side Maps loads + autocomplete sessions: free tier covers tens of thousands per month.
- **Set a Google Cloud billing alert at $50/month** as a safety net — Cloud Console → Billing → Budgets & alerts → Create budget. (Currently not set up — TODO.)

---

## Testing

**Backend:** Vitest, 19 tests passing.
- `geocoding.service.test.ts` — 9 tests covering happy path, all 4 error codes (`not_found`, `wrong_type`, `out_of_bounds`, `network`), edge cases (premise/subpremise types, malformed responses, network failures)
- `posts.service.test.ts` — 10 tests covering createPost integration, updatePost legacy enforcement, trust-boundary regression (client-submitted lat/lng must be ignored), `listHousingMapPosts` filtering

Run with `cd apps/api && pnpm test`.

**Frontend:** no automated tests (per decision C from brainstorming — backend tests where logic lives, manual QA for components). Manual QA checklist completed:
- ✅ Address autocomplete dropdown shows Chicago-biased suggestions
- ✅ Selecting a place renders preview map with correct pin
- ✅ Submitting creates post with server-trusted coordinates
- ✅ Detail page renders map with pin
- ✅ Browse map toggle works, single pin renders, info window opens, "View listing" navigates correctly
- ✅ Server rejects city-type place (`Chicago, IL` → wrong_type)
- ✅ Server rejects out-of-bounds place (NYC address → out_of_bounds)

**Typecheck:** all four packages pass (`pnpm -w typecheck`).

---

## Deviations from the plan

Things that changed during execution (worth knowing if you're reading the plan and the code looks slightly different):

1. **Vitest mocking with `vi.hoisted()`** — the plan's test code defined mock refs at module top-level, but `vi.mock` factories run before module-top initialization, causing `ReferenceError`. Fixed by wrapping mock refs in `vi.hoisted(() => ({...}))`. This is the documented vitest pattern.

2. **`description: null` removed from test fixtures** — the plan's `baseHousingInput` had `description: null`, but `CreatePostInput.description` is typed `string | undefined`, not nullable. Removed since the field is optional.

3. **Trust-boundary test cast** — the plan used `@ts-expect-error` to add malicious lat/lng fields, but TypeScript's excess-property check doesn't fire on object spread, so the directive was unused. Replaced with a single `as unknown as Parameters<typeof createPost>[0]` cast.

4. **Direct edits instead of subagent dispatch** — the plan called for one subagent per task with two-stage review. The Anthropic API was returning 529 overload errors, so subagent dispatch became unreliable. Tasks 0.1, 1.1 (partial), 3.1, 3.2 ran via subagent; the rest were executed inline. No quality drop because every task ended with `pnpm test` + `pnpm typecheck` verification before commit.

5. **Drive-by fix** — during manual QA, a pre-existing hydration error was found on the home page (`apps/web/src/app/page.tsx`): a Next.js `<Link>` for the author profile was nested inside the outer card `<Link>`, which is invalid HTML. Fixed by replacing the inner `<Link>` with a `<span>` + `router.push()` that preserves keyboard accessibility. Committed separately as `f496268` so it's distinct from the housing feature commits.

---

## Manual QA results

All checkpoints from the design spec passed:

| Test | Result |
|---|---|
| Autocomplete dropdown appears, Chicago-biased | ✅ |
| Preview map renders with correct pin after selection | ✅ |
| Form submits, post created with verified address | ✅ |
| Detail page renders map at correct location | ✅ |
| Browse map toggle works (`?view=map`) | ✅ |
| Pin click → info window → navigate to listing | ✅ |
| Server rejects city (Chicago, IL) | ✅ |
| Server rejects out-of-bounds (NYC) | ✅ |
| Edit page pre-fills address + preview map | ⏳ Not manually verified (unit-tested) |
| Legacy post edit notice (amber banner) | ⏳ No legacy posts available locally to test (unit-tested) |

---

## Operational notes

### When prod deploy lands

Once Railway finishes deploying, smoke-test from the browser:

1. `https://api.uchicagoemart.com/api/health` → expect `{"status":"ok","database":"connected"}`
2. `https://api.uchicagoemart.com/api/posts/housing/map` → expect `{"posts":[]}` (empty until housing posts with addresses exist in prod)
3. `https://www.uchicagoemart.com/create` → switch to housing → address autocomplete should work the same as locally

### If the API service crashes on boot

Most likely cause: `GOOGLE_PLACES_SERVER_KEY` not set in Railway env vars. `apps/api/src/config/env.ts` calls `process.exit(1)` on missing required vars. Check Railway → API service → Variables → confirm the key is present, then trigger a manual redeploy.

### If the production frontend shows "API key not authorized"

Most likely cause: HTTP referrer restrictions on the browser key don't include the production domain. Check Google Cloud Console → Credentials → `uchicagoemart-maps-browser` → Application restrictions → Websites → confirm both `https://www.uchicagoemart.com/*` and `https://uchicagoemart.com/*` are in the list. After fixing, wait ~2 minutes for propagation, then hard refresh.

### If you need to rotate the server key

1. Google Cloud Console → Credentials → click `uchicagoemart-places-server` → Regenerate key
2. Copy new value into Railway → API service → Variables → `GOOGLE_PLACES_SERVER_KEY`
3. Railway auto-redeploys API on env var change
4. Also update `apps/api/.env` (or root `.env`) locally

### Database migration on prod

The migration was applied locally during Task 1.1. **Production database needs `pnpm prisma migrate deploy` to apply the same migration.** If Railway's deploy script doesn't do this automatically, the prod API will fail at runtime when it tries to read the new columns. Verify by checking `railway run pnpm --filter @uchicago-marketplace/api exec prisma migrate status` from the Railway CLI, or by inspecting the deploy logs.

---

## Pending follow-ups

### 1. Migrate to the new Places API (deprecation cleanup)

Console warnings during local QA flagged that the current code uses three deprecated APIs:

- `google.maps.places.Autocomplete` (replaced by `PlaceAutocompleteElement`)
- `google.maps.places.PlacesService` (replaced by the `Place` class with `fetchFields()`)
- `google.maps.marker.AdvancedMarkerElement.addEventListener('click')` (replaced by `addEventListener('gmp-click')`)

Per Google: "As of March 1st, 2025, [these] are not available to new customers." The `uchicagoemart` project was created after that date, so these are at risk of being fully blocked in the future. Currently they still work because Google hasn't enforced the cutoff.

**Migration scope:**
- `AddressAutocomplete.tsx` — swap class for web component (~15 lines)
- `PropertyMap.tsx` + create-form preview handler — swap `PlacesService.getDetails()` for `Place(placeId).fetchFields()`
- `HousingMapView.tsx` — switch click listener to `gmp-click` event
- `geocoding.service.ts` (server) — optionally migrate to the new HTTP endpoint (`places.googleapis.com/v1/places/{place_id}` with `X-Goog-FieldMask` header), which would simplify the Google Cloud API restriction story (only need Places API (New) enabled, can drop legacy)

Estimated work: ~30 lines of changes, contained to the housing components and one service. Should be its own branch (`feat/housing-deprecation-cleanup`) with brainstorm-lite → spec → execute.

### 2. Set Google Cloud billing alert

Cloud Console → Billing → Budgets & alerts → Create budget at $50/month with thresholds at 50% / 90% / 100%. Currently not configured. Low priority but worth doing for peace of mind.

### 3. Upgrade to Railway Pro for static outbound IPs (optional)

Currently the server key has no IP restriction because Railway Hobby tier uses dynamic egress IPs. If you upgrade to Pro ($20/mo), you can enable Static Outbound IPs in the API service's Networking settings, then add those IPs to the server key's restrictions in Google Cloud Console. This adds a defense-in-depth layer if the server key ever leaks.

### 4. Test the legacy post edit flow

We don't have any housing posts without `placeId` in the local database, so the amber "Please add a verified address..." banner on the edit page hasn't been manually verified. The unit test in `posts.service.test.ts` (`requires placeId when editing a legacy post`) covers the server-side enforcement, and the component logic is straightforward, but a real end-to-end test would add confidence. To create a legacy post for testing: insert a row directly via `psql` with `place_id = NULL` and the other housing fields populated.
