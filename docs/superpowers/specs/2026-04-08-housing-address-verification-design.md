# Housing Address Verification & Map View — Design

**Date:** 2026-04-08
**Status:** Approved, ready for implementation planning
**Scope:** Housing listings only (not marketplace or storage)

## Goal

Prevent fake and scam housing listings on the UChicago Marketplace by requiring sellers to pick a real, verified street address from a Google Places autocomplete picker, and surface the exact location on a map at three points in the app: the create form (as a preview), the listing detail page, and a new clustered map view on the browse page.

## Non-Goals

- International addresses (US-only, Chicago-area only)
- Ownership verification (e.g., lease upload, admin review) — out of scope
- Approximate/fuzzed locations for privacy — exact address is shown
- Map-bounds filtering on browse ("search this area") — deferred to a later iteration
- Active backfill of legacy housing posts (no banners, admin tools, or batch processes). Legacy posts remain visible in list view and are excluded from the map until their owner next edits the post, at which point the address field becomes required before save.
- Admin tooling to manually set coordinates for edge cases
- Caching of Google responses (premature optimization)

## Constraints & Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Primary goal | Scam/typo prevention via real address picker | User directive |
| Privacy model | Exact address, pin on building | User directive — student sublet/passdown context |
| Map provider | Google Maps + Places API (New) | Best-in-class autocomplete quality directly serves the scam-prevention goal; free tier covers expected volume |
| Map placements | Detail page + create-form preview + browse-page clustered map | User directive (scope "C") |
| Browse map behavior | Toggle + clustering, no bounds filtering | Balances usability with implementation cost; bounds filtering deferred |
| Migration strategy | Hard cutover — address required for new posts, legacy excluded from map | User directive — scam prevention needs teeth from day one |
| Trust boundary | Server owns coordinates; client is renderer only | Hybrid approach — client submits `placeId`, server calls Google Place Details to resolve canonical coords |
| Geographic scope | Chicago bbox enforced (client bias + server hard reject) | UChicago-specific app |

## Architecture

```
Frontend (apps/web)                      Backend (apps/api)
─────────────────                        ──────────────────
<AddressAutocomplete>     ─placeId─>     POST /api/posts
  (Google Places JS,                     ├─ geocoding.service.ts (new)
   browser-restricted key)               │   └─ verifyPlaceId(placeId)
                                         │       └─ Google Place Details API
<PropertyMap>                            │           (server-side key)
  (Google Maps JS,                       └─ posts.service.ts
   reused on create preview                  └─ stores Google-returned
   and detail page)                              address/lat/lng

                                         GET /api/posts/housing/map
<HousingMapView>                         └─ lightweight projection
  (browse page, clustered                    for map pins
   via MarkerClusterer)
```

**Key principle:** Client-submitted coordinates are never trusted. The client sends only a Google `placeId`; the backend resolves it to a canonical address and coordinates via Google's Place Details API using a separate server-side key.

## Data Flow

### Create-post flow
1. Seller types in `<AddressAutocomplete>` — Google JS SDK shows predictions biased toward UChicago
2. Seller picks a prediction → component captures `place_id`, shows `<PropertyMap>` preview with pin (preview uses client-side `PlacesService.getDetails` for lat/lng, server re-verifies independently on submit)
3. Seller confirms pin is correct (or re-searches if wrong)
4. On form submit, client sends `{ ...post, housingDetails: { ...fields, placeId } }` — no lat/lng from the client
5. API calls `verifyPlaceId(placeId)`, which queries Google Place Details with the server-side key
6. API rejects if Google returns non-OK status, if place types are not building-level (`street_address`, `premise`, `subpremise`), or if coords fall outside Chicago bbox
7. API stores canonical `address`, `latitude`, `longitude`, `placeId` on `HousingDetails`

### Detail-page flow
Post API returns lat/lng when present → `<PropertyMap>` renders Google map centered on coords with single pin. Legacy posts without coords render a "Location not verified" note instead.

### Browse-map flow
Browse page has a list/map toggle in the header (segmented buttons). Map view fetches `GET /api/posts/housing/map`, renders pins via `@googlemaps/markerclusterer`. Clicking a cluster zooms to its bounds; clicking a pin shows an info window with thumbnail, title, rent, bed/bath, and a "View listing" link. Toggle state persisted to URL as `?view=map`.

## Data Model

### Prisma schema changes

`apps/api/prisma/schema.prisma` — extend `HousingDetails`:

```prisma
model HousingDetails {
  // ... existing fields ...
  neighborhood        String?

  // NEW — address verification
  address             String?   // canonical formatted_address from Google
  latitude            Float?
  longitude           Float?
  placeId             String?   @map("place_id")

  // ... rest ...
  @@map("housing_details")
  @@index([latitude, longitude])
}
```

**Nullability rationale:** Hard cutover means address is required for *new* posts via application-layer validation, but legacy rows have no values. Nullable columns avoid a destructive migration; enforcement happens in the Zod schema and service layer for new writes only.

**Migration:** single additive migration — four columns + one index, no data backfill. Idempotent, follows the pattern in the existing `users.address` column migration.

### Zod schema changes

`packages/shared/src/schemas/post.schema.ts`:

```ts
// Request: server receives only placeId
const housingDetailsSchema = z.object({
  // ... existing fields ...
  placeId: z.string().min(1, "Please select an address from the dropdown"),
});

// Response: server returns resolved fields
const housingDetailsResponseSchema = housingDetailsSchema.extend({
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});
```

The request/response split enforces "server owns coordinates" at the type level. The request type does not contain `latitude`/`longitude`, so a well-behaved client cannot even accidentally submit them.

## Backend

### New file: `apps/api/src/services/geocoding.service.ts`

```ts
export type VerifiedPlace = {
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
};

export class PlaceVerificationError extends Error {
  constructor(public code: "not_found" | "wrong_type" | "out_of_bounds" | "network", message: string) {
    super(message);
  }
}

export async function verifyPlaceId(placeId: string): Promise<VerifiedPlace> {
  // 1. Call Google Place Details API with fields=formatted_address,geometry,place_id,types
  //    using GOOGLE_PLACES_SERVER_KEY
  // 2. Reject if status !== "OK" (throw PlaceVerificationError "not_found")
  // 3. Reject if result.types doesn't intersect ["street_address", "premise", "subpremise"]
  //    (throw "wrong_type" — filters out cities, neighborhoods, countries)
  // 4. Reject if lat/lng outside Chicago bbox (default 41.6,-87.9 to 42.1,-87.5,
  //    configurable via GEOCODING_CHICAGO_BBOX env var)
  // 5. Return { address: formatted_address, latitude, longitude, placeId }
}
```

**Type filtering** is the primary scam defense beyond the autocomplete UI. Google returns `types: ["locality", "political"]` for "Chicago, IL" and `["neighborhood"]` for "Hyde Park" — we reject those, requiring a specific building.

**Chicago bbox** is a secondary defense: rejects a valid street address in, say, Manhattan even if the seller somehow obtained its placeId.

### Changes to `apps/api/src/services/posts.service.ts`

In `createPost`, when category is `housing`:
```ts
const verified = await verifyPlaceId(housingDetails.placeId);
housingDetailsToCreate = {
  ...housingDetails,
  address: verified.address,
  latitude: verified.latitude,
  longitude: verified.longitude,
  placeId: verified.placeId,
};
```

In `updatePost`: if `placeId` changed, re-verify; if unchanged, skip the Google call (cost optimization).

`verifyPlaceId` errors are mapped to HTTP 400 with `{ error: "invalid_address", message: string }` — the frontend surfaces this under the address field.

### New endpoint: `GET /api/posts/housing/map`

Returns a lightweight projection for the browse map — only fields the map UI needs:
```ts
{
  posts: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    monthlyRent: number;
    latitude: number;
    longitude: number;
  }>;
}
```

Filters: housing posts only, `latitude IS NOT NULL`, respects existing visibility rules (active status, not deleted, not hidden). No pagination in v1 — clustering handles pin density; bounding-box filtering is a follow-up.

## Frontend

All new components live under `apps/web/src/components/housing/`.

### `<GoogleMapsLoader>` — app-level provider

Wraps `@googlemaps/js-api-loader`, loads the Maps JS SDK exactly once per session with `libraries: ["places", "marker"]`. Exposes `useGoogleMaps()` returning `{ isLoaded, loadError }`. Mounted in the root layout; initializes lazily on first consumer.

### `<AddressAutocomplete>` — create form input

```tsx
<AddressAutocomplete
  value={placeId}
  onSelect={(place) => setPlaceId(place.placeId)}
  error={errors.placeId}
/>
```

Uses Google's `PlaceAutocompleteElement` (the current-gen web component, replacing the deprecated `Autocomplete` class). Configured with:
- `componentRestrictions: { country: "us" }`
- `types: ["address"]` — buildings only, not regions
- `locationBias`: circular bias around UChicago (41.7886, -87.5987) with ~10km radius

On selection, fires `onSelect({ placeId })`. Does **not** capture or expose lat/lng. Typing after selection clears `placeId` to force a re-pick. Styled to match existing form inputs (Tailwind, maroon accents).

### `<PropertyMap>` — single-pin map

```tsx
<PropertyMap
  latitude={41.7886}
  longitude={-87.5987}
  address="1234 E 55th St, Chicago, IL"
  height={300}
/>
```

Renders a Google Map centered on the coords at zoom 16, single `AdvancedMarkerElement`. Minimal controls (zoom only). Info window on marker click shows formatted address. Used in two places:

1. **Create-form preview:** appears below `<AddressAutocomplete>` the moment a place is selected. Uses client-side `PlacesService.getDetails(placeId)` to fetch coords for preview (does not undermine security because the server re-verifies independently on submit). If the client-side lookup fails, the preview is hidden but selection still succeeds — the server will re-verify on submit either way. Gives the seller instant visual confirmation: "is this the right building?"
2. **Detail page:** appears inside `HousingDetailsSection` below the neighborhood/amenities block. Coords come from the API response.

### `<HousingMapView>` — browse-page clustered map

```tsx
<HousingMapView posts={mapPosts} onPinClick={(id) => router.push(`/posts/${id}`)} />
```

Full-width map, default center on UChicago. Uses `@googlemaps/markerclusterer` for clustering. Pins are price badges (e.g., "$1200") built with `AdvancedMarkerElement`. Clicking a pin opens a compact info window with thumbnail, title, rent, bed/bath, and a "View listing" link. Clicking a cluster zooms to fit its bounds.

### Changes to existing files

- `apps/web/src/app/create/page.tsx` — add `<AddressAutocomplete>` + `<PropertyMap>` preview in the housing fields section
- `apps/web/src/app/posts/[id]/client-page.tsx` — add `<PropertyMap>` inside `HousingDetailsSection`
- `apps/web/src/app/browse/page.tsx` — add list/map view toggle (segmented buttons, `?view=map` URL param) and conditional `<HousingMapView>` rendering

## Edge Cases & Errors

### Create-form
- **No selection from dropdown** → Zod validation fails on submit; error "Please select an address from the dropdown suggestions"
- **Google script fails to load** → `<AddressAutocomplete>` shows fallback "Address verification temporarily unavailable." Submit disabled for housing. No freetext fallback — that would defeat the goal.
- **Server `verifyPlaceId` failure** → API returns 400; form shows error under address field; other form state preserved
- **Valid address outside Chicago bbox** → same treatment, error: "Address must be in the Chicago area"
- **User picks address, then edits the text without re-picking** → `placeId` cleared, preview hidden, must re-pick

### Detail page
- **Legacy post without coords** → `<PropertyMap>` not rendered; existing `neighborhood` text shown with subtle note "Exact location not available for this listing."
- **Coords exist but Maps script fails** → skeleton with fallback "Map unavailable. Address: {address}"

### Browse map
- **No posts with coords** → empty state: "No housing listings with verified addresses yet. Switch to list view to see all listings."
- **API 500 on `/housing/map`** → toast error, fallback to list view
- **Rapid toggle** → components unmount cleanly, no memory leaks (loader handles this)

### Update flow
- **Address unchanged** → no Google call, coords preserved
- **Address changed** → client sends new `placeId`, server re-verifies
- **Legacy post owner edits** → address field now required to save; edit form shows a one-line notice: "Please add a verified address to continue editing this listing."

## Configuration & Secrets

### Two Google Cloud API keys

| Key | Location | Restrictions | APIs enabled |
|---|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | `apps/web/.env` | HTTP referrer restricted to prod domain + localhost for dev | Maps JavaScript API, Places API (New) |
| `GOOGLE_PLACES_SERVER_KEY` | `apps/api/.env` | IP-restricted (prod API server) or unrestricted in dev | Places API (New) — Place Details only |

**Why two keys:** The browser key must ship in client JS, so it's locked down by referrer. The server key is never exposed, enabling server-side Place Details calls without abuse risk.

### Env var additions

```bash
# apps/web/.env.example
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=

# apps/api/.env.example
GOOGLE_PLACES_SERVER_KEY=
# Optional — default 41.6,-87.9,42.1,-87.5 baked into service
GEOCODING_CHICAGO_BBOX=41.6,-87.9,42.1,-87.5
```

Both `.env.example` files updated with comments pointing to Google Cloud Console setup.

### Startup validation

`apps/api/src/index.ts` throws on boot if `GOOGLE_PLACES_SERVER_KEY` is missing — fail fast. Same pattern in `<GoogleMapsLoader>` at runtime.

### Content Security Policy

If a CSP exists on the web app, add to `script-src`, `img-src`, `connect-src`:
- `maps.googleapis.com`
- `maps.gstatic.com`
- `*.googleapis.com`

If no CSP exists today, no change needed — flag as future security hardening.

### Cost guardrails

- Server Place Details: ~$17 per 1000 calls. At 100 new housing posts/day ≈ $51/month.
- Browser-side autocomplete + map loads: billed per session. Free tier covers tens of thousands/month.
- Set a **Google Cloud billing alert at $50/month** as a safety net (manual console setup).

All usage expected to fit within Google's $200/month free credit.

## Testing Strategy

### Backend

**`geocoding.service.test.ts`** — mocks `fetch`:
- Happy path: valid building `placeId` → returns `{ address, lat, lng, placeId }`
- `ZERO_RESULTS` from Google → throws `PlaceVerificationError("not_found")`
- Place types = `["locality"]` → throws `"wrong_type"`
- Coords outside Chicago bbox → throws `"out_of_bounds"`
- Network failure → throws `"network"`

**`posts.service.test.ts`** — new tests:
- `createPost` housing with valid `placeId` → calls `verifyPlaceId` once, persists returned coords
- `createPost` with invalid `placeId` → throws, no row written
- `updatePost` with unchanged `placeId` → skips Google call
- `updatePost` with changed `placeId` → re-verifies
- **Trust-boundary regression:** client-submitted `latitude`/`longitude` in request body are ignored

**Integration tests:**
- `POST /api/posts` end-to-end with mocked geocoding service — only server-resolved coords reach the DB
- `GET /api/posts/housing/map` — legacy posts excluded, active posts with coords included, thumbnail URL resolved

### Frontend

**`<AddressAutocomplete>`** — mock Google SDK:
- Typing triggers predictions
- Selecting fires `onSelect({ placeId })`
- Typing after selection clears `placeId`
- SDK load failure shows fallback + disables submit

**`<PropertyMap>`** — snapshot, pin renders at given coords, info window opens on click

**`<HousingMapView>`** — one pin per post, pin click triggers navigation, empty state when `posts=[]`

**Create-page integration test** — fill housing form, pick address, submit, assert API called with `placeId` and no `lat`/`lng`

### Manual QA checklist

1. Create a housing post with a real Chicago address — verify map preview pin, detail-page pin
2. Try to submit without picking from dropdown → error
3. Try to pick a city ("Chicago, IL") → rejected
4. Try an address outside Chicago → rejected server-side
5. View a legacy post (no coords) → no map, shows "location not verified" note
6. Browse page → toggle to map → verify clusters, click through to a listing
7. Disconnect network mid-create → graceful error, form state preserved
8. Browser key locked to prod domain → localhost still works via referrer exemption

### Not tested

- Google's API itself (trust their SLA)
- Map rendering pixels (brittle, low value)
- Clustering algorithm correctness (trust the library)

## Open Questions

None. All decisions locked during brainstorming.

## Summary of Files Touched

**New files:**
- `apps/api/src/services/geocoding.service.ts`
- `apps/api/src/routes/` — new route for `GET /api/posts/housing/map` (or add to existing `posts.ts`)
- `apps/api/prisma/migrations/<timestamp>_housing_address/migration.sql`
- `apps/web/src/components/housing/GoogleMapsLoader.tsx`
- `apps/web/src/components/housing/AddressAutocomplete.tsx`
- `apps/web/src/components/housing/PropertyMap.tsx`
- `apps/web/src/components/housing/HousingMapView.tsx`

**Modified files:**
- `apps/api/prisma/schema.prisma`
- `apps/api/src/services/posts.service.ts`
- `apps/api/src/index.ts` (env validation)
- `apps/api/.env.example`
- `apps/web/src/app/create/page.tsx`
- `apps/web/src/app/posts/[id]/client-page.tsx`
- `apps/web/src/app/browse/page.tsx`
- `apps/web/src/app/layout.tsx` (mount `<GoogleMapsLoader>`)
- `apps/web/.env.example`
- `packages/shared/src/schemas/post.schema.ts`
- `packages/shared/src/types/` (if response types are exported separately)
