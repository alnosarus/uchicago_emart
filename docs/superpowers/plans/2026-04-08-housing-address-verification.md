# Housing Address Verification & Map View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Places–backed address verification to housing listings, show verified addresses on a map in the create form, detail page, and a new clustered browse-page map view.

**Architecture:** Hybrid client/server integration with Google Maps. Client uses `@googlemaps/js-api-loader` for autocomplete and map rendering with a browser-restricted key. Client sends only `placeId` to the API; server uses a separate server-side key to call Google Place Details and stores only Google-authoritative coordinates. Browse page gains a list/map toggle with clustered pins.

**Tech Stack:** Prisma, Express, Zod, Google Maps JavaScript API, Google Places API (New), `@googlemaps/js-api-loader`, `@googlemaps/markerclusterer`, Vitest (new, for backend only), Next.js 16, Tailwind v4.

**Reference spec:** [docs/superpowers/specs/2026-04-08-housing-address-verification-design.md](../specs/2026-04-08-housing-address-verification-design.md)

---

## File Structure

**New backend files:**
- `apps/api/vitest.config.ts` — test runner config (Phase 0)
- `apps/api/src/services/geocoding.service.ts` — `verifyPlaceId` function
- `apps/api/src/services/geocoding.service.test.ts` — geocoding unit tests
- `apps/api/prisma/migrations/<timestamp>_housing_address/migration.sql` — Prisma-generated

**Modified backend files:**
- `apps/api/package.json` — add vitest
- `apps/api/prisma/schema.prisma` — add address columns to HousingDetails
- `apps/api/src/config/env.ts` — add new env vars
- `apps/api/src/services/posts.service.ts` — wire verifyPlaceId into create + update
- `apps/api/src/routes/posts.ts` — add `GET /api/posts/housing/map`
- `apps/api/.env.example` — document new env vars

**Modified shared package:**
- `packages/shared/src/schemas/post.schema.ts` — add `placeId` to housing schema, allow it on update

**New frontend files:**
- `apps/web/src/components/housing/GoogleMapsLoader.tsx` — SDK loader + context
- `apps/web/src/components/housing/AddressAutocomplete.tsx` — input component
- `apps/web/src/components/housing/PropertyMap.tsx` — single-pin map (create preview + detail)
- `apps/web/src/components/housing/HousingMapView.tsx` — clustered browse map

**Modified frontend files:**
- `apps/web/package.json` — add Google Maps packages
- `apps/web/.env.example` — add browser key
- `apps/web/src/app/layout.tsx` — mount `<GoogleMapsLoader>`
- `apps/web/src/app/create/page.tsx` — add address input + preview map
- `apps/web/src/app/posts/[id]/client-page.tsx` — add detail map
- `apps/web/src/app/posts/[id]/edit/page.tsx` — add address input + preview + legacy notice
- `apps/web/src/app/browse/page.tsx` — add list/map toggle + clustered map

---

## Phase 0: Backend Test Infrastructure

### Task 0.1: Install and configure Vitest in apps/api

**Files:**
- Create: `apps/api/vitest.config.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install vitest**

```bash
cd apps/api && pnpm add -D vitest@^2.1.0
```

Expected: installs vitest to devDependencies. No errors.

- [ ] **Step 2: Create vitest config**

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.test.ts"],
    // Don't run Prisma-dependent integration tests in unit runs — we mock Prisma
    setupFiles: [],
  },
});
```

- [ ] **Step 3: Add test script to package.json**

Modify `apps/api/package.json` — add under `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Final `scripts` section should be:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "typecheck": "tsc --noEmit",
  "lint": "echo 'no linter configured yet'",
  "test": "vitest run",
  "test:watch": "vitest",
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 4: Create a smoke test to verify the runner works**

Create `apps/api/src/services/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test**

```bash
cd apps/api && pnpm test
```

Expected: `1 passed`. Vitest reports exit code 0.

- [ ] **Step 6: Delete the smoke test**

```bash
rm apps/api/src/services/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(api): add vitest test runner"
```

---

## Phase 1: Data Model

### Task 1.1: Add address columns to HousingDetails

**Files:**
- Modify: `apps/api/prisma/schema.prisma:202-222`
- Create: `apps/api/prisma/migrations/<timestamp>_housing_address/migration.sql`

- [ ] **Step 1: Add columns to the Prisma schema**

Edit `apps/api/prisma/schema.prisma`, replace the `HousingDetails` model (lines ~202-222) with:

```prisma
model HousingDetails {
  postId              String         @id @map("post_id")
  post                Post           @relation(fields: [postId], references: [id], onDelete: Cascade)
  subtype             HousingSubtype
  side                HousingSide
  monthlyRent         Float          @map("monthly_rent")
  bedrooms            String
  bathrooms           String
  neighborhood        String?
  amenities           String[]       @default([])
  roommates           RoommateType
  roommateCount       Int?           @map("roommate_count")
  moveInDate          DateTime?      @map("move_in_date")
  moveOutDate         DateTime?      @map("move_out_date")
  leaseStartDate      DateTime?      @map("lease_start_date")
  leaseDurationMonths Int?           @map("lease_duration_months")

  // Address verification (added 2026-04-08)
  address             String?
  latitude            Float?
  longitude           Float?
  placeId             String?        @map("place_id")

  @@index([latitude, longitude])
  @@map("housing_details")
}
```

Note: if `postId` was not previously `@map("post_id")`, leave its existing mapping alone — only add the new fields and index.

- [ ] **Step 2: Generate the migration**

```bash
cd apps/api && pnpm prisma migrate dev --name housing_address --create-only
```

Expected: a new migration directory under `prisma/migrations/` is created with `migration.sql`. The `--create-only` flag generates the migration without applying it so we can inspect it.

- [ ] **Step 3: Inspect the generated SQL**

Read the generated `migration.sql`. It should contain roughly:

```sql
ALTER TABLE "housing_details" ADD COLUMN "address" TEXT,
ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION,
ADD COLUMN "place_id" TEXT;

CREATE INDEX "housing_details_latitude_longitude_idx" ON "housing_details"("latitude", "longitude");
```

If the generated SQL drops/recreates anything or touches columns other than the four new ones + the index, stop and investigate — something in the schema is out of sync.

- [ ] **Step 4: Make the migration idempotent**

Follow the repo pattern from `fix(db): make rideshare drift cleanup migration idempotent`. Edit `migration.sql` to guard each DDL statement:

```sql
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "place_id" TEXT;

CREATE INDEX IF NOT EXISTS "housing_details_latitude_longitude_idx" ON "housing_details"("latitude", "longitude");
```

- [ ] **Step 5: Apply the migration**

```bash
cd apps/api && pnpm prisma migrate dev
```

Expected: migration applies cleanly. `prisma generate` runs automatically and updates the client types.

- [ ] **Step 6: Verify typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: passes. No errors about missing fields on `HousingDetails`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(db): add address/lat/lng/place_id to housing_details"
```

---

## Phase 2: Shared Schema

### Task 2.1: Add `placeId` to housing details schema

**Files:**
- Modify: `packages/shared/src/schemas/post.schema.ts:38-52, 100-106`

- [ ] **Step 1: Add placeId field to housingDetailsSchema**

Edit `packages/shared/src/schemas/post.schema.ts`. Replace the `housingDetailsSchema` definition (lines ~38-52) with:

```ts
export const housingDetailsSchema = z.object({
  subtype: housingSubtypeEnum,
  side: housingSideEnum,
  monthlyRent: z.number().min(0).nullable(),
  bedrooms: bedroomsEnum,
  bathrooms: bathroomsEnum,
  neighborhood: z.string().nullable().optional(),
  amenities: z.array(z.string()).default([]),
  roommates: roommateTypeEnum,
  roommateCount: z.number().int().min(1).nullable().optional(),
  moveInDate: z.string().nullable().optional(),
  moveOutDate: z.string().nullable().optional(),
  leaseStartDate: z.string().nullable().optional(),
  leaseDurationMonths: z.number().int().min(1).nullable().optional(),

  // Address verification — client sends placeId, server resolves to canonical address/coords
  placeId: z.string().min(1, "Please select an address from the dropdown"),
});
```

- [ ] **Step 2: Verify updatePostSchema still compiles**

The existing `updatePostSchema` at line ~100 uses `housingDetailsSchema.partial()`, which will make `placeId` optional on updates automatically. No change needed to `updatePostSchema` — partial-update semantics are correct (legacy-post enforcement happens in the service layer, Task 3.3).

- [ ] **Step 3: Build the shared package**

```bash
cd packages/shared && pnpm build
```

Expected: TypeScript compiles cleanly. `dist/` updated.

- [ ] **Step 4: Typecheck the API (consumes shared)**

```bash
cd apps/api && pnpm typecheck
```

Expected: fails on `posts.service.ts` and/or route handlers because `housing` objects now need a `placeId`. This is expected — we'll fix it in Phase 3.

If it fails for any *other* reason, stop and investigate.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/post.schema.ts packages/shared/dist/
git commit -m "feat(shared): require placeId in housing details schema"
```

---

## Phase 3: Backend Geocoding & Integration

### Task 3.1: Create the geocoding service with tests (TDD)

**Files:**
- Create: `apps/api/src/services/geocoding.service.ts`
- Create: `apps/api/src/services/geocoding.service.test.ts`
- Modify: `apps/api/src/config/env.ts` (new env vars)

- [ ] **Step 1: Add env vars**

Edit `apps/api/src/config/env.ts`. Add to the `envSchema` object:

```ts
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_ID_IOS: z.string().optional(),
  GOOGLE_CLIENT_ID_ANDROID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  ALLOWED_EMAIL_DOMAIN: z.string().default("uchicago.edu"),

  // Google Places address verification (added 2026-04-08)
  GOOGLE_PLACES_SERVER_KEY: z.string().min(1),
  // Chicago bounding box: minLat,minLng,maxLat,maxLng
  GEOCODING_CHICAGO_BBOX: z.string().default("41.6,-87.9,42.1,-87.5"),
});
```

- [ ] **Step 2: Update `.env.example` with the new vars**

Edit `apps/api/.env.example`. Append:

```bash
# Google Places API (server-side key, unrestricted or IP-restricted)
# Used by geocoding.service.ts to resolve place_id → canonical address + lat/lng
# Get one from Google Cloud Console → APIs & Services → Credentials
# Enable "Places API (New)" on the project
GOOGLE_PLACES_SERVER_KEY=

# Optional: Chicago bounding box for address sanity check
# Format: minLat,minLng,maxLat,maxLng
# Default covers greater Chicago (Hyde Park, UChicago, surrounding neighborhoods)
GEOCODING_CHICAGO_BBOX=41.6,-87.9,42.1,-87.5
```

- [ ] **Step 3: Also add to your local `.env` so the server can boot**

Edit `apps/api/.env` (not committed) and add a real test key or placeholder:

```bash
GOOGLE_PLACES_SERVER_KEY=your-key-here
```

If you don't have a real key yet, use a dummy string. The service calls will fail, but env validation will pass. Real key goes in before running integration tests.

- [ ] **Step 4: Write the failing geocoding test file**

Create `apps/api/src/services/geocoding.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyPlaceId, PlaceVerificationError } from "./geocoding.service";

// Mock the env module so tests don't require a real key
vi.mock("../config/env", () => ({
  env: {
    GOOGLE_PLACES_SERVER_KEY: "test-key",
    GEOCODING_CHICAGO_BBOX: "41.6,-87.9,42.1,-87.5",
  },
}));

// Valid Google Place Details response for a UChicago-area building
const validResponse = {
  status: "OK",
  result: {
    place_id: "ChIJTEST_VALID",
    formatted_address: "1234 E 55th St, Chicago, IL 60615, USA",
    geometry: { location: { lat: 41.7943, lng: -87.5907 } },
    types: ["street_address"],
  },
};

describe("verifyPlaceId", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns canonical address, lat, lng for a valid building place_id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => validResponse,
    });

    const result = await verifyPlaceId("ChIJTEST_VALID");

    expect(result).toEqual({
      address: "1234 E 55th St, Chicago, IL 60615, USA",
      latitude: 41.7943,
      longitude: -87.5907,
      placeId: "ChIJTEST_VALID",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    // Sanity-check the URL includes our key and the place_id
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("place_id=ChIJTEST_VALID");
    expect(calledUrl).toContain("key=test-key");
  });

  it("throws 'not_found' when Google returns ZERO_RESULTS", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ZERO_RESULTS", result: null }),
    });

    await expect(verifyPlaceId("ChIJBOGUS")).rejects.toThrow(PlaceVerificationError);
    await expect(verifyPlaceId("ChIJBOGUS")).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws 'not_found' when Google returns INVALID_REQUEST", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ status: "INVALID_REQUEST" }),
    });

    await expect(verifyPlaceId("badid")).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws 'wrong_type' when the place is a city (locality)", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJCHICAGO",
          formatted_address: "Chicago, IL, USA",
          geometry: { location: { lat: 41.8781, lng: -87.6298 } },
          types: ["locality", "political"],
        },
      }),
    });

    await expect(verifyPlaceId("ChIJCHICAGO")).rejects.toMatchObject({ code: "wrong_type" });
  });

  it("throws 'wrong_type' when the place is a neighborhood", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJHYDEPARK",
          formatted_address: "Hyde Park, Chicago, IL, USA",
          geometry: { location: { lat: 41.794, lng: -87.59 } },
          types: ["neighborhood", "political"],
        },
      }),
    });

    await expect(verifyPlaceId("ChIJHYDEPARK")).rejects.toMatchObject({ code: "wrong_type" });
  });

  it("accepts 'premise' and 'subpremise' types", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJAPT",
          formatted_address: "1234 E 55th St Apt 3, Chicago, IL 60615, USA",
          geometry: { location: { lat: 41.7943, lng: -87.5907 } },
          types: ["subpremise"],
        },
      }),
    });

    const result = await verifyPlaceId("ChIJAPT");
    expect(result.address).toContain("Apt 3");
  });

  it("throws 'out_of_bounds' when lat/lng falls outside Chicago bbox", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "OK",
        result: {
          place_id: "ChIJNYC",
          formatted_address: "350 5th Ave, New York, NY 10118, USA",
          geometry: { location: { lat: 40.7484, lng: -73.9857 } },
          types: ["street_address"],
        },
      }),
    });

    await expect(verifyPlaceId("ChIJNYC")).rejects.toMatchObject({ code: "out_of_bounds" });
  });

  it("throws 'network' when fetch itself rejects", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(verifyPlaceId("ChIJTEST")).rejects.toMatchObject({ code: "network" });
  });

  it("throws 'network' when HTTP response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

    await expect(verifyPlaceId("ChIJTEST")).rejects.toMatchObject({ code: "network" });
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
cd apps/api && pnpm test geocoding
```

Expected: FAIL with "Failed to resolve import './geocoding.service'" or similar — the service file doesn't exist yet.

- [ ] **Step 6: Create the geocoding service**

Create `apps/api/src/services/geocoding.service.ts`:

```ts
import { env } from "../config/env";

export type VerifiedPlace = {
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
};

export type PlaceVerificationErrorCode =
  | "not_found"
  | "wrong_type"
  | "out_of_bounds"
  | "network";

export class PlaceVerificationError extends Error {
  constructor(
    public code: PlaceVerificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PlaceVerificationError";
  }
}

const BUILDING_TYPES = new Set(["street_address", "premise", "subpremise"]);

type Bbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

function parseBbox(str: string): Bbox {
  const parts = str.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid GEOCODING_CHICAGO_BBOX: ${str}`);
  }
  const [minLat, minLng, maxLat, maxLng] = parts;
  return { minLat, minLng, maxLat, maxLng };
}

function inBbox(lat: number, lng: number, bbox: Bbox): boolean {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

/**
 * Resolves a Google Place ID to a canonical, verified address.
 *
 * Security/trust note: this is the ONLY authoritative source of coordinates
 * for housing listings. Never trust lat/lng submitted by clients.
 *
 * Throws PlaceVerificationError with a machine-readable `code` for all
 * failure modes — caller maps these to HTTP 400 responses.
 */
export async function verifyPlaceId(placeId: string): Promise<VerifiedPlace> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "place_id,formatted_address,geometry,types");
  url.searchParams.set("key", env.GOOGLE_PLACES_SERVER_KEY);

  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch (err) {
    throw new PlaceVerificationError("network", `Network error contacting Google: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new PlaceVerificationError("network", `Google returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    status: string;
    result?: {
      place_id: string;
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
      types: string[];
    };
  };

  if (body.status !== "OK" || !body.result) {
    throw new PlaceVerificationError("not_found", `Google Place Details returned status ${body.status}`);
  }

  const { result } = body;

  const isBuilding = result.types.some((t) => BUILDING_TYPES.has(t));
  if (!isBuilding) {
    throw new PlaceVerificationError(
      "wrong_type",
      "Please select a specific street address, not a city or neighborhood",
    );
  }

  const bbox = parseBbox(env.GEOCODING_CHICAGO_BBOX);
  const { lat, lng } = result.geometry.location;
  if (!inBbox(lat, lng, bbox)) {
    throw new PlaceVerificationError(
      "out_of_bounds",
      "Address must be in the Chicago area",
    );
  }

  return {
    address: result.formatted_address,
    latitude: lat,
    longitude: lng,
    placeId: result.place_id,
  };
}
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd apps/api && pnpm test geocoding
```

Expected: all 9 tests pass. If any fail, read the failure, fix, re-run.

- [ ] **Step 8: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors *in the geocoding service*. Existing errors in `posts.service.ts` about missing `placeId` are expected and will be fixed in Task 3.2.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/services/geocoding.service.ts \
        apps/api/src/services/geocoding.service.test.ts \
        apps/api/src/config/env.ts \
        apps/api/.env.example
git commit -m "feat(api): add geocoding service for Google Place ID verification"
```

---

### Task 3.2: Wire geocoding into createPost

**Files:**
- Modify: `apps/api/src/services/posts.service.ts:39-53` (housing input type), `:57-126` (createPost)

- [ ] **Step 1: Extend the housing input type to include placeId**

Edit `apps/api/src/services/posts.service.ts`. In the `CreatePostInput` interface (around line 39), update the `housing` field:

```ts
  housing?: {
    subtype: string;
    side: string;
    monthlyRent: number;
    bedrooms: string;
    bathrooms: string;
    neighborhood?: string | null;
    amenities?: string[];
    roommates: string;
    roommateCount?: number | null;
    moveInDate?: string | null;
    moveOutDate?: string | null;
    leaseStartDate?: string | null;
    leaseDurationMonths?: number | null;
    placeId: string;  // NEW — required by shared schema for housing posts
  };
```

- [ ] **Step 2: Import the geocoding service**

At the top of `apps/api/src/services/posts.service.ts`, add:

```ts
import { verifyPlaceId, PlaceVerificationError } from "./geocoding.service";
import { HttpError } from "../utils/errors";  // already imported — skip if duplicate
```

- [ ] **Step 3: Call verifyPlaceId before creating a housing post**

Replace the `createPost` function body. The key change: verify `placeId` before the `prisma.post.create` call, and merge the verified fields into the housing create payload.

Find this block (around line 93-111):

```ts
      ...(housing && {
        housing: {
          create: {
            subtype: housing.subtype as any,
            side: housing.side as any,
            monthlyRent: housing.monthlyRent,
            bedrooms: housing.bedrooms,
            bathrooms: housing.bathrooms,
            neighborhood: housing.neighborhood ?? null,
            amenities: housing.amenities ?? [],
            roommates: housing.roommates as any,
            roommateCount: housing.roommateCount ?? null,
            moveInDate: housing.moveInDate ? new Date(housing.moveInDate) : null,
            moveOutDate: housing.moveOutDate ? new Date(housing.moveOutDate) : null,
            leaseStartDate: housing.leaseStartDate ? new Date(housing.leaseStartDate) : null,
            leaseDurationMonths: housing.leaseDurationMonths ?? null,
          },
        },
      }),
```

Restructure `createPost` to verify first, then build the data object. Replace the entire `createPost` function (lines ~57-126) with:

```ts
export async function createPost(input: CreatePostInput) {
  const { authorId, type, side, title, description, marketplace, storage, housing, imageUrls } = input;

  // Resolve housing address via Google Place Details BEFORE creating the post.
  // Client-submitted lat/lng is never stored — only Google-authoritative values.
  let verifiedHousing: Awaited<ReturnType<typeof verifyPlaceId>> | null = null;
  if (housing) {
    try {
      verifiedHousing = await verifyPlaceId(housing.placeId);
    } catch (err) {
      if (err instanceof PlaceVerificationError) {
        throw new HttpError(400, err.message);
      }
      throw err;
    }
  }

  return prisma.post.create({
    data: {
      authorId,
      type,
      side: side as any,
      title,
      description: description || null,
      ...(marketplace && {
        marketplace: {
          create: {
            priceType: marketplace.priceType as any,
            priceAmount: marketplace.priceAmount ?? null,
            condition: mapCondition(marketplace.condition) as any,
            category: marketplace.category,
            tradeDescription: marketplace.tradeDescription ?? null,
            tags: marketplace.tags || [],
          },
        },
      }),
      ...(storage && {
        storage: {
          create: {
            startDate: new Date(storage.startDate),
            endDate: new Date(storage.endDate),
            size: storage.size as any,
            locationType: storage.locationType as any,
            neighborhood: storage.neighborhood ?? null,
            priceMonthly: storage.priceMonthly ?? null,
            isFree: storage.isFree ?? false,
            restrictions: storage.restrictions ?? null,
          },
        },
      }),
      ...(housing && verifiedHousing && {
        housing: {
          create: {
            subtype: housing.subtype as any,
            side: housing.side as any,
            monthlyRent: housing.monthlyRent,
            bedrooms: housing.bedrooms,
            bathrooms: housing.bathrooms,
            neighborhood: housing.neighborhood ?? null,
            amenities: housing.amenities ?? [],
            roommates: housing.roommates as any,
            roommateCount: housing.roommateCount ?? null,
            moveInDate: housing.moveInDate ? new Date(housing.moveInDate) : null,
            moveOutDate: housing.moveOutDate ? new Date(housing.moveOutDate) : null,
            leaseStartDate: housing.leaseStartDate ? new Date(housing.leaseStartDate) : null,
            leaseDurationMonths: housing.leaseDurationMonths ?? null,
            // Server-authoritative address fields (NEVER from client)
            address: verifiedHousing.address,
            latitude: verifiedHousing.latitude,
            longitude: verifiedHousing.longitude,
            placeId: verifiedHousing.placeId,
          },
        },
      }),
      ...(imageUrls && imageUrls.length > 0 && {
        images: {
          create: imageUrls.map((url, i) => ({ url, order: i })),
        },
      }),
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
      marketplace: true,
      storage: true,
      housing: true,
      images: { orderBy: { order: "asc" } },
    },
  });
}
```

- [ ] **Step 4: Write test for createPost's trust boundary**

Create `apps/api/src/services/posts.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks — must be defined before the module import
const verifyPlaceIdMock = vi.fn();
const postCreateMock = vi.fn();
const postFindUniqueMock = vi.fn();
const postUpdateMock = vi.fn();
const postFindManyMock = vi.fn();

vi.mock("./geocoding.service", () => ({
  verifyPlaceId: verifyPlaceIdMock,
  PlaceVerificationError: class PlaceVerificationError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  },
}));

vi.mock("../config/database", () => ({
  prisma: {
    post: {
      create: (...args: unknown[]) => postCreateMock(...args),
      findUnique: (...args: unknown[]) => postFindUniqueMock(...args),
      update: (...args: unknown[]) => postUpdateMock(...args),
      findMany: (...args: unknown[]) => postFindManyMock(...args),
    },
  },
}));

// Import AFTER mocks are set up
import { createPost, updatePost } from "./posts.service";
import { HttpError } from "../utils/errors";

const baseHousingInput = {
  authorId: "user-1",
  type: "housing" as const,
  side: "offering",
  title: "Cozy sublet",
  description: null,
  housing: {
    subtype: "sublet",
    side: "offering",
    monthlyRent: 1200,
    bedrooms: "1",
    bathrooms: "1",
    neighborhood: null,
    amenities: [],
    roommates: "solo",
    roommateCount: null,
    moveInDate: null,
    moveOutDate: null,
    leaseStartDate: null,
    leaseDurationMonths: null,
    placeId: "ChIJVALID",
  },
};

const verifiedPlace = {
  address: "1234 E 55th St, Chicago, IL 60615, USA",
  latitude: 41.7943,
  longitude: -87.5907,
  placeId: "ChIJVALID",
};

describe("createPost — housing address verification", () => {
  beforeEach(() => {
    verifyPlaceIdMock.mockReset();
    postCreateMock.mockReset();
    postCreateMock.mockResolvedValue({ id: "post-1" });
  });

  it("verifies placeId and stores Google-authoritative fields on housing create", async () => {
    verifyPlaceIdMock.mockResolvedValue(verifiedPlace);

    await createPost(baseHousingInput);

    expect(verifyPlaceIdMock).toHaveBeenCalledWith("ChIJVALID");
    const createArg = postCreateMock.mock.calls[0][0];
    expect(createArg.data.housing.create).toMatchObject({
      address: verifiedPlace.address,
      latitude: verifiedPlace.latitude,
      longitude: verifiedPlace.longitude,
      placeId: verifiedPlace.placeId,
    });
  });

  it("throws HttpError 400 when verifyPlaceId rejects with PlaceVerificationError", async () => {
    const { PlaceVerificationError } = await import("./geocoding.service");
    verifyPlaceIdMock.mockRejectedValue(
      new PlaceVerificationError("wrong_type", "Please select a street address"),
    );

    await expect(createPost(baseHousingInput)).rejects.toThrow(HttpError);
    await expect(createPost(baseHousingInput)).rejects.toMatchObject({
      status: 400,
      message: "Please select a street address",
    });
    expect(postCreateMock).not.toHaveBeenCalled();
  });

  it("never stores client-submitted latitude/longitude (trust boundary)", async () => {
    verifyPlaceIdMock.mockResolvedValue(verifiedPlace);

    // Sneak forged coordinates into the input — TypeScript allows this because
    // we're casting, and a real malicious client would do the same at the HTTP layer
    const maliciousInput = {
      ...baseHousingInput,
      housing: {
        ...baseHousingInput.housing,
        // @ts-expect-error — intentionally adding fields not in the type
        latitude: 0,
        longitude: 0,
      },
    };

    await createPost(maliciousInput);

    const createArg = postCreateMock.mock.calls[0][0];
    // The stored coords must match Google's, not the client's
    expect(createArg.data.housing.create.latitude).toBe(verifiedPlace.latitude);
    expect(createArg.data.housing.create.longitude).toBe(verifiedPlace.longitude);
  });

  it("does not call verifyPlaceId for non-housing posts", async () => {
    verifyPlaceIdMock.mockResolvedValue(verifiedPlace);

    await createPost({
      authorId: "user-1",
      type: "marketplace",
      side: "sell",
      title: "Textbook",
      marketplace: {
        priceType: "fixed",
        priceAmount: 20,
        condition: "good",
        category: "books",
      },
    });

    expect(verifyPlaceIdMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd apps/api && pnpm test posts.service
```

Expected: all 4 tests pass.

- [ ] **Step 6: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: passes — `createPost` errors are gone. `updatePost` may still error because the housing type in `UpdatePostInput` doesn't have `placeId` yet; that's fine, Task 3.3 fixes it.

If typecheck fails for any *other* reason, stop and investigate.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/posts.service.ts apps/api/src/services/posts.service.test.ts
git commit -m "feat(api): verify and store canonical housing address on post create"
```

---

### Task 3.3: Wire geocoding into updatePost + legacy enforcement

**Files:**
- Modify: `apps/api/src/services/posts.service.ts:335-417` (UpdatePostInput, updatePost)

- [ ] **Step 1: Add placeId to the update input type**

Edit `apps/api/src/services/posts.service.ts`. In the `UpdatePostInput` interface (around line 335), update the `housing` field:

```ts
  housing?: {
    subtype?: string;
    side?: string;
    monthlyRent?: number | null;
    bedrooms?: string;
    bathrooms?: string;
    neighborhood?: string | null;
    amenities?: string[];
    roommates?: string;
    roommateCount?: number | null;
    moveInDate?: string | null;
    moveOutDate?: string | null;
    leaseStartDate?: string | null;
    leaseDurationMonths?: number | null;
    placeId?: string;  // NEW — optional on update (changed = re-verify, unchanged = skip)
  };
```

- [ ] **Step 2: Implement the update-flow rules in updatePost**

Replace the `updatePost` function (lines ~352-417) with:

```ts
export async function updatePost(postId: string, userId: string, input: UpdatePostInput) {
  const existing = await prisma.post.findUnique({
    where: { id: postId },
    include: { housing: true },
  });
  if (!existing) throw new HttpError(404, "Post not found");
  if (existing.authorId !== userId) throw new HttpError(403, "Not authorized to edit this post");
  if (existing.status === "deleted") throw new HttpError(404, "Post not found");

  // Housing address verification rules on update:
  //   1. If the existing post is housing AND has no placeId (legacy post):
  //      input.housing.placeId is REQUIRED.
  //   2. If input.housing.placeId is provided AND differs from existing: re-verify.
  //   3. If input.housing.placeId is provided AND matches existing: skip re-verify.
  //   4. If input.housing.placeId is omitted on a post that already has one: no change.
  let verifiedHousing: Awaited<ReturnType<typeof verifyPlaceId>> | null = null;
  const isHousingPost = existing.type === "housing";

  if (isHousingPost) {
    const legacyMissingAddress = !existing.housing?.placeId;
    const incomingPlaceId = input.housing?.placeId;

    if (legacyMissingAddress && !incomingPlaceId) {
      throw new HttpError(
        400,
        "This listing needs a verified address. Please select an address from the dropdown before saving.",
      );
    }

    if (incomingPlaceId && incomingPlaceId !== existing.housing?.placeId) {
      try {
        verifiedHousing = await verifyPlaceId(incomingPlaceId);
      } catch (err) {
        if (err instanceof PlaceVerificationError) {
          throw new HttpError(400, err.message);
        }
        throw err;
      }
    }
  }

  return prisma.post.update({
    where: { id: postId },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.marketplace && {
        marketplace: {
          update: {
            ...(input.marketplace.priceType && { priceType: input.marketplace.priceType as any }),
            ...(input.marketplace.priceAmount !== undefined && { priceAmount: input.marketplace.priceAmount }),
            ...(input.marketplace.condition && { condition: mapCondition(input.marketplace.condition) as any }),
            ...(input.marketplace.category && { category: input.marketplace.category }),
            ...(input.marketplace.tradeDescription !== undefined && { tradeDescription: input.marketplace.tradeDescription }),
            ...(input.marketplace.tags && { tags: input.marketplace.tags }),
          },
        },
      }),
      ...(input.storage && {
        storage: {
          update: {
            ...(input.storage.startDate && { startDate: new Date(input.storage.startDate) }),
            ...(input.storage.endDate && { endDate: new Date(input.storage.endDate) }),
            ...(input.storage.size && { size: input.storage.size as any }),
            ...(input.storage.locationType && { locationType: input.storage.locationType as any }),
            ...(input.storage.neighborhood !== undefined && { neighborhood: input.storage.neighborhood }),
            ...(input.storage.priceMonthly !== undefined && { priceMonthly: input.storage.priceMonthly }),
            ...(input.storage.isFree !== undefined && { isFree: input.storage.isFree }),
            ...(input.storage.restrictions !== undefined && { restrictions: input.storage.restrictions }),
          },
        },
      }),
      ...(input.housing && {
        housing: {
          update: {
            ...(input.housing.subtype && { subtype: input.housing.subtype }),
            ...(input.housing.side && { side: input.housing.side }),
            ...(input.housing.monthlyRent !== undefined && { monthlyRent: input.housing.monthlyRent }),
            ...(input.housing.bedrooms && { bedrooms: input.housing.bedrooms }),
            ...(input.housing.bathrooms && { bathrooms: input.housing.bathrooms }),
            ...(input.housing.neighborhood !== undefined && { neighborhood: input.housing.neighborhood }),
            ...(input.housing.amenities && { amenities: input.housing.amenities }),
            ...(input.housing.roommates !== undefined && { roommates: input.housing.roommates }),
            ...(input.housing.roommateCount !== undefined && { roommateCount: input.housing.roommateCount }),
            ...(input.housing.moveInDate && { moveInDate: new Date(input.housing.moveInDate) }),
            ...(input.housing.moveOutDate && { moveOutDate: new Date(input.housing.moveOutDate) }),
            ...(input.housing.leaseStartDate && { leaseStartDate: new Date(input.housing.leaseStartDate) }),
            ...(input.housing.leaseDurationMonths !== undefined && { leaseDurationMonths: input.housing.leaseDurationMonths }),
            // Only write address fields when we re-verified
            ...(verifiedHousing && {
              address: verifiedHousing.address,
              latitude: verifiedHousing.latitude,
              longitude: verifiedHousing.longitude,
              placeId: verifiedHousing.placeId,
            }),
          } as any,
        },
      }),
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
      marketplace: true,
      storage: true,
      housing: true,
      images: { orderBy: { order: "asc" } },
    },
  });
}
```

- [ ] **Step 3: Add updatePost tests**

Append to `apps/api/src/services/posts.service.test.ts`:

```ts
describe("updatePost — housing address verification", () => {
  const existingHousing = {
    id: "post-1",
    authorId: "user-1",
    type: "housing" as const,
    status: "active",
    housing: {
      postId: "post-1",
      placeId: "ChIJEXISTING",
      address: "123 Old St, Chicago, IL",
      latitude: 41.79,
      longitude: -87.59,
    },
  };

  beforeEach(() => {
    verifyPlaceIdMock.mockReset();
    postFindUniqueMock.mockReset();
    postUpdateMock.mockReset();
    postUpdateMock.mockResolvedValue({ id: "post-1" });
  });

  it("skips verifyPlaceId when placeId is unchanged", async () => {
    postFindUniqueMock.mockResolvedValue(existingHousing);

    await updatePost("post-1", "user-1", {
      housing: { placeId: "ChIJEXISTING", monthlyRent: 1400 },
    });

    expect(verifyPlaceIdMock).not.toHaveBeenCalled();
    const updateArg = postUpdateMock.mock.calls[0][0];
    // Address fields should NOT be in the update payload
    expect(updateArg.data.housing.update.address).toBeUndefined();
    expect(updateArg.data.housing.update.latitude).toBeUndefined();
  });

  it("re-verifies when placeId changes", async () => {
    postFindUniqueMock.mockResolvedValue(existingHousing);
    verifyPlaceIdMock.mockResolvedValue({
      address: "456 New St, Chicago, IL",
      latitude: 41.80,
      longitude: -87.60,
      placeId: "ChIJNEW",
    });

    await updatePost("post-1", "user-1", {
      housing: { placeId: "ChIJNEW" },
    });

    expect(verifyPlaceIdMock).toHaveBeenCalledWith("ChIJNEW");
    const updateArg = postUpdateMock.mock.calls[0][0];
    expect(updateArg.data.housing.update.address).toBe("456 New St, Chicago, IL");
    expect(updateArg.data.housing.update.placeId).toBe("ChIJNEW");
  });

  it("requires placeId when editing a legacy post (no existing placeId)", async () => {
    postFindUniqueMock.mockResolvedValue({
      ...existingHousing,
      housing: { ...existingHousing.housing, placeId: null, address: null, latitude: null, longitude: null },
    });

    await expect(
      updatePost("post-1", "user-1", { housing: { monthlyRent: 1400 } }),
    ).rejects.toMatchObject({ status: 400, message: /verified address/ });
    expect(verifyPlaceIdMock).not.toHaveBeenCalled();
    expect(postUpdateMock).not.toHaveBeenCalled();
  });

  it("allows editing a legacy post when placeId is now provided", async () => {
    postFindUniqueMock.mockResolvedValue({
      ...existingHousing,
      housing: { ...existingHousing.housing, placeId: null, address: null, latitude: null, longitude: null },
    });
    verifyPlaceIdMock.mockResolvedValue({
      address: "789 Legacy St, Chicago, IL",
      latitude: 41.79,
      longitude: -87.59,
      placeId: "ChIJFIRSTTIME",
    });

    await updatePost("post-1", "user-1", {
      housing: { placeId: "ChIJFIRSTTIME", monthlyRent: 1500 },
    });

    expect(verifyPlaceIdMock).toHaveBeenCalledWith("ChIJFIRSTTIME");
    const updateArg = postUpdateMock.mock.calls[0][0];
    expect(updateArg.data.housing.update.address).toBe("789 Legacy St, Chicago, IL");
  });

  it("throws 400 when new placeId is invalid", async () => {
    const { PlaceVerificationError } = await import("./geocoding.service");
    postFindUniqueMock.mockResolvedValue(existingHousing);
    verifyPlaceIdMock.mockRejectedValue(
      new PlaceVerificationError("out_of_bounds", "Address must be in the Chicago area"),
    );

    await expect(
      updatePost("post-1", "user-1", { housing: { placeId: "ChIJNYC" } }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Address must be in the Chicago area",
    });
    expect(postUpdateMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd apps/api && pnpm test posts.service
```

Expected: all 9 tests pass (4 from Task 3.2 + 5 new).

- [ ] **Step 5: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: passes, no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/posts.service.ts apps/api/src/services/posts.service.test.ts
git commit -m "feat(api): verify housing address on update, enforce on legacy edits"
```

---

### Task 3.4: Add GET /api/posts/housing/map endpoint

**Files:**
- Modify: `apps/api/src/services/posts.service.ts` (add listHousingMapPosts)
- Modify: `apps/api/src/routes/posts.ts` (add route)

- [ ] **Step 1: Add the service function**

Append to `apps/api/src/services/posts.service.ts` (after `listPosts`):

```ts
// ── Housing Map View ──────────────────────────

export async function listHousingMapPosts() {
  const posts = await prisma.post.findMany({
    where: {
      type: "housing",
      status: "active",
      housing: {
        latitude: { not: null },
        longitude: { not: null },
      },
    },
    include: {
      housing: true,
      images: { orderBy: { order: "asc" }, take: 1 },
    },
    take: 500, // hard cap to prevent runaway payloads
  });

  return {
    posts: posts
      .filter((p) => p.housing?.latitude != null && p.housing?.longitude != null)
      .map((p) => ({
        id: p.id,
        title: p.title,
        thumbnailUrl: p.images[0]?.url ?? null,
        monthlyRent: p.housing!.monthlyRent,
        latitude: p.housing!.latitude!,
        longitude: p.housing!.longitude!,
      })),
  };
}
```

- [ ] **Step 2: Add the route**

Edit `apps/api/src/routes/posts.ts`. Add the import:

```ts
import {
  createPost,
  listPosts,
  listHousingMapPosts,  // NEW
  getPostById,
  updatePost,
  deletePost,
  addPostImages,
  deletePostImage,
  reorderPostImages,
} from "../services/posts.service";
```

Add the route **before** `GET /api/posts/:id` (order matters — `/housing/map` must not be matched by `/:id`):

```ts
// GET /api/posts/housing/map — Lightweight projection of housing posts with coordinates
router.get("/housing/map", optionalAuth, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await listHousingMapPosts();
    res.json(result);
  } catch (err) { next(err); }
});
```

Place it directly after the `GET /api/posts` list handler (around line 40), before `GET /api/posts/:id`.

- [ ] **Step 3: Write the service test**

Append to `apps/api/src/services/posts.service.test.ts`:

```ts
describe("listHousingMapPosts", () => {
  beforeEach(() => {
    postFindManyMock.mockReset();
  });

  it("returns only housing posts with non-null lat/lng", async () => {
    postFindManyMock.mockResolvedValue([
      {
        id: "p1",
        title: "Sublet A",
        images: [{ url: "https://img/a.jpg" }],
        housing: { monthlyRent: 1200, latitude: 41.79, longitude: -87.59 },
      },
    ]);

    const { listHousingMapPosts } = await import("./posts.service");
    const result = await listHousingMapPosts();

    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]).toEqual({
      id: "p1",
      title: "Sublet A",
      thumbnailUrl: "https://img/a.jpg",
      monthlyRent: 1200,
      latitude: 41.79,
      longitude: -87.59,
    });

    // Verify the Prisma where clause filtered by coords
    const findManyArg = postFindManyMock.mock.calls[0][0];
    expect(findManyArg.where.type).toBe("housing");
    expect(findManyArg.where.status).toBe("active");
    expect(findManyArg.where.housing.latitude).toEqual({ not: null });
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass (geocoding + posts.service including the new map test).

- [ ] **Step 5: Manual smoke test of the endpoint**

Start the API:

```bash
cd apps/api && pnpm dev
```

In another terminal:

```bash
curl http://localhost:3000/api/posts/housing/map
```

Expected: `{"posts":[]}` (empty because no housing posts have coords yet). 200 status.

Stop the API.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/posts.service.ts \
        apps/api/src/services/posts.service.test.ts \
        apps/api/src/routes/posts.ts
git commit -m "feat(api): add GET /api/posts/housing/map endpoint"
```

---

## Phase 4: Frontend Foundation

### Task 4.1: Install Google Maps packages

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install packages**

```bash
cd apps/web && pnpm add @googlemaps/js-api-loader@^1.16.8 @googlemaps/markerclusterer@^2.5.3 @types/google.maps@^3.58.1
```

Expected: three packages added. No errors.

- [ ] **Step 2: Verify types resolve**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes (no new errors — we haven't imported the libs yet).

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add Google Maps dependencies"
```

---

### Task 4.2: Add browser API key env var

**Files:**
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Append to `.env.example`**

Append to `apps/web/.env.example`:

```bash
# Google Maps JavaScript API (browser-restricted key)
# Required for address autocomplete and map rendering on the housing feature.
# Create in Google Cloud Console → Credentials → Create API Key.
# Restrict to HTTP referrers: localhost:3001/*, www.uchicagoemart.com/*, uchicagoemart.com/*
# Enable: Maps JavaScript API, Places API (New)
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=
```

- [ ] **Step 2: Add a real (or placeholder) value to `.env.local`**

Edit `apps/web/.env.local` (not committed):

```bash
NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=your-browser-key-here
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/.env.example
git commit -m "chore(web): document Google Maps browser API key env var"
```

---

### Task 4.3: Create GoogleMapsLoader provider

**Files:**
- Create: `apps/web/src/components/housing/GoogleMapsLoader.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Create the loader component**

Create `apps/web/src/components/housing/GoogleMapsLoader.tsx`:

```tsx
"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type GoogleMapsContextValue = {
  isLoaded: boolean;
  loadError: Error | null;
};

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: null,
});

let loaderPromise: Promise<typeof google> | null = null;

function getLoaderPromise(): Promise<typeof google> {
  if (loaderPromise) return loaderPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY is not configured"),
    );
  }

  const loader = new Loader({
    apiKey,
    version: "weekly",
    libraries: ["places", "marker"],
  });

  loaderPromise = loader.load();
  return loaderPromise;
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLoaderPromise()
      .then(() => {
        if (!cancelled) setIsLoaded(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err as Error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps(): GoogleMapsContextValue {
  return useContext(GoogleMapsContext);
}
```

- [ ] **Step 2: Mount the provider in the root layout**

Edit `apps/web/src/app/layout.tsx`. Find the JSX that wraps `{children}` (likely inside a `<body>` tag with auth + socket providers). Add `<GoogleMapsProvider>` as an inner wrapper.

Example — adjust to match the actual existing provider structure:

```tsx
import { GoogleMapsProvider } from "@/components/housing/GoogleMapsLoader";

// ... inside the layout JSX, wrap {children}:
<GoogleMapsProvider>
  {children}
</GoogleMapsProvider>
```

Place it **inside** the auth/socket providers so consumers can use both.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes. If "Cannot find module '@googlemaps/js-api-loader'" — the package didn't install; re-run Task 4.1 Step 1.

- [ ] **Step 4: Manual smoke test**

```bash
cd apps/web && pnpm dev
```

Open http://localhost:3001 in the browser. Open DevTools → Network tab. Load a page. Confirm:
- `maps.googleapis.com/maps/api/js?...` request fires
- Returns 200 (if your API key is real) or 403 (if placeholder — that's fine for now, validates the plumbing)
- No JavaScript console errors about missing env vars

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/housing/GoogleMapsLoader.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): add GoogleMapsProvider for lazy SDK loading"
```

---

## Phase 5: Frontend Components

### Task 5.1: AddressAutocomplete component

**Files:**
- Create: `apps/web/src/components/housing/AddressAutocomplete.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/housing/AddressAutocomplete.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useGoogleMaps } from "./GoogleMapsLoader";

// UChicago main quad — used as the center for location bias
const UCHICAGO_CENTER = { lat: 41.7886, lng: -87.5987 };
const BIAS_RADIUS_METERS = 10_000;

export type SelectedPlace = {
  placeId: string;
  formattedAddress: string;
};

type Props = {
  onSelect: (place: SelectedPlace | null) => void;
  initialValue?: string;
  error?: string | null;
  disabled?: boolean;
};

export function AddressAutocomplete({ onSelect, initialValue, error, disabled }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [hasSelection, setHasSelection] = useState(Boolean(initialValue));

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    // Using the classic Autocomplete class — the newer PlaceAutocompleteElement
    // is a web component with different integration, and this is simpler for now.
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      types: ["address"],
      fields: ["place_id", "formatted_address", "types"],
      bounds: new google.maps.Circle({
        center: UCHICAGO_CENTER,
        radius: BIAS_RADIUS_METERS,
      }).getBounds() ?? undefined,
      strictBounds: false,
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (place.place_id && place.formatted_address) {
        setHasSelection(true);
        onSelect({
          placeId: place.place_id,
          formattedAddress: place.formatted_address,
        });
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      listener.remove();
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [isLoaded, onSelect]);

  // When the user types AFTER selecting, clear the selection
  // (forces them to re-pick from the dropdown)
  function handleInput() {
    if (hasSelection) {
      setHasSelection(false);
      onSelect(null);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Address verification is temporarily unavailable. Please try again in a moment.
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        defaultValue={initialValue ?? ""}
        onInput={handleInput}
        disabled={disabled || !isLoaded}
        placeholder={isLoaded ? "Start typing an address…" : "Loading address search…"}
        className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-600 ${
          error ? "border-red-500" : "border-gray-300"
        }`}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {!error && hasSelection && (
        <p className="mt-1 text-xs text-green-700">Address verified ✓</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes. The `google.maps` global type comes from `@types/google.maps`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/housing/AddressAutocomplete.tsx
git commit -m "feat(web): add AddressAutocomplete component"
```

Manual QA happens in Task 6.1 when we integrate it into the create form.

---

### Task 5.2: PropertyMap component

**Files:**
- Create: `apps/web/src/components/housing/PropertyMap.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/housing/PropertyMap.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useGoogleMaps } from "./GoogleMapsLoader";

type Props = {
  latitude: number;
  longitude: number;
  address?: string;
  height?: number;
  zoom?: number;
};

export function PropertyMap({ latitude, longitude, address, height = 300, zoom = 16 }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    const center = { lat: latitude, lng: longitude };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom,
        mapId: "HOUSING_PROPERTY_MAP",
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
    } else {
      mapInstanceRef.current.setCenter(center);
      mapInstanceRef.current.setZoom(zoom);
    }

    // Clean up old marker
    if (markerRef.current) {
      markerRef.current.map = null;
    }

    markerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map: mapInstanceRef.current,
      position: center,
      title: address,
    });

    if (address) {
      const infoWindow = new google.maps.InfoWindow({ content: address });
      markerRef.current.addListener("click", () => {
        infoWindow.open({ map: mapInstanceRef.current!, anchor: markerRef.current! });
      });
    }
  }, [isLoaded, latitude, longitude, address, zoom]);

  if (loadError) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-600"
      >
        Map unavailable{address ? `. Address: ${address}` : ""}
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-md border border-gray-200 bg-gray-50"
      aria-label={address ? `Map showing ${address}` : "Property map"}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/housing/PropertyMap.tsx
git commit -m "feat(web): add PropertyMap single-pin map component"
```

---

### Task 5.3: HousingMapView (clustered browse map)

**Files:**
- Create: `apps/web/src/components/housing/HousingMapView.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/housing/HousingMapView.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useGoogleMaps } from "./GoogleMapsLoader";

const UCHICAGO_CENTER = { lat: 41.7886, lng: -87.5987 };
const DEFAULT_ZOOM = 13;

export type HousingMapPost = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  monthlyRent: number;
  latitude: number;
  longitude: number;
};

type Props = {
  posts: HousingMapPost[];
  onPinClick: (postId: string) => void;
};

function formatPrice(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function buildInfoWindowContent(post: HousingMapPost): string {
  const thumb = post.thumbnailUrl
    ? `<img src="${post.thumbnailUrl}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:6px;" />`
    : "";
  return `
    <div style="max-width:200px;font-family:system-ui,sans-serif;">
      ${thumb}
      <div style="font-weight:600;margin-bottom:2px;">${post.title}</div>
      <div style="font-size:14px;color:#333;">${formatPrice(post.monthlyRent)}/mo</div>
      <div style="margin-top:6px;"><a data-post-id="${post.id}" class="housing-map-link" style="color:#800000;font-weight:500;cursor:pointer;">View listing →</a></div>
    </div>
  `;
}

export function HousingMapView({ posts, onPinClick }: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: UCHICAGO_CENTER,
        zoom: DEFAULT_ZOOM,
        mapId: "HOUSING_BROWSE_MAP",
        disableDefaultUI: false,
        clickableIcons: false,
      });
      infoWindowRef.current = new google.maps.InfoWindow();

      // Delegate clicks on "View listing" links inside info windows
      google.maps.event.addListener(infoWindowRef.current, "domready", () => {
        const links = document.querySelectorAll<HTMLElement>(".housing-map-link");
        links.forEach((link) => {
          link.addEventListener("click", () => {
            const id = link.getAttribute("data-post-id");
            if (id) onPinClick(id);
          });
        });
      });
    }

    // Clear existing clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
    }

    // Build markers
    const markers = posts.map((post) => {
      const badge = document.createElement("div");
      badge.style.cssText = `
        background:#800000;color:white;padding:4px 8px;border-radius:12px;
        font-size:12px;font-weight:600;box-shadow:0 2px 4px rgba(0,0,0,0.2);
        white-space:nowrap;
      `;
      badge.textContent = formatPrice(post.monthlyRent);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: post.latitude, lng: post.longitude },
        content: badge,
        title: post.title,
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !mapInstanceRef.current) return;
        infoWindowRef.current.setContent(buildInfoWindowContent(post));
        infoWindowRef.current.open({ map: mapInstanceRef.current, anchor: marker });
      });

      return marker;
    });

    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current,
      markers,
    });

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
    };
  }, [isLoaded, posts, onPinClick]);

  if (loadError) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-sm text-gray-600">
        Map unavailable. Switch to list view to see all listings.
      </div>
    );
  }

  if (posts.length === 0 && isLoaded) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-center text-sm text-gray-600">
        No housing listings with verified addresses yet.
        <br />
        Switch to list view to see all listings.
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-[600px] w-full overflow-hidden rounded-md border border-gray-200"
      aria-label="Map of housing listings"
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/housing/HousingMapView.tsx
git commit -m "feat(web): add HousingMapView clustered browse map"
```

---

## Phase 6: Page Integration

### Task 6.1: Integrate address + preview into create page

**Files:**
- Modify: `apps/web/src/app/create/page.tsx` (housing form section, around lines 788+; also the housing form state interface around lines 113-127; and the submit handler)

- [ ] **Step 1: Read the current housing form section to confirm exact structure**

```bash
# Quick check: find the line numbers where housing fields are rendered
```

Use Grep to find the housing section:

```bash
grep -n "HousingFields\|housing.*subtype\|housing.*monthlyRent" apps/web/src/app/create/page.tsx
```

- [ ] **Step 2: Add placeId to the HousingFields state**

Edit `apps/web/src/app/create/page.tsx`. Find the `HousingFields` interface (around line 113) and add:

```ts
interface HousingFields {
  // ... existing fields ...
  placeId: string;
  addressLabel: string;     // the formatted address shown to the user
  addressError: string | null;
}
```

Initialize these in the housing default state object:

```ts
// Find the object where housing fields are initialized and add:
placeId: "",
addressLabel: "",
addressError: null,
```

- [ ] **Step 3: Add imports**

At the top of `create/page.tsx`:

```tsx
import { AddressAutocomplete } from "@/components/housing/AddressAutocomplete";
import { PropertyMap } from "@/components/housing/PropertyMap";
import { useGoogleMaps } from "@/components/housing/GoogleMapsLoader";
```

- [ ] **Step 4: Add local state for the preview coords**

Inside the main component function, alongside other useState calls, add:

```tsx
const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null);
const { isLoaded: isMapsLoaded } = useGoogleMaps();
```

- [ ] **Step 5: Add a handler that fetches client-side preview coords**

Still inside the component, add:

```tsx
async function handleAddressSelect(place: { placeId: string; formattedAddress: string } | null) {
  if (!place) {
    setHousingFields((prev) => ({ ...prev, placeId: "", addressLabel: "", addressError: null }));
    setPreviewCoords(null);
    return;
  }

  setHousingFields((prev) => ({
    ...prev,
    placeId: place.placeId,
    addressLabel: place.formattedAddress,
    addressError: null,
  }));

  // Optional client-side preview — fetch lat/lng for the map pin.
  // If this fails, the preview simply doesn't show; server still re-verifies on submit.
  if (!isMapsLoaded) return;
  try {
    const svc = new google.maps.places.PlacesService(document.createElement("div"));
    svc.getDetails(
      { placeId: place.placeId, fields: ["geometry"] },
      (details, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && details?.geometry?.location) {
          setPreviewCoords({
            lat: details.geometry.location.lat(),
            lng: details.geometry.location.lng(),
          });
        } else {
          setPreviewCoords(null);
        }
      },
    );
  } catch {
    setPreviewCoords(null);
  }
}
```

- [ ] **Step 6: Render AddressAutocomplete + PropertyMap in the housing form**

In the JSX where housing fields are rendered (around line 788+), add a new field group **before** the neighborhood input:

```tsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-gray-700">
    Address <span className="text-red-500">*</span>
  </label>
  <p className="text-xs text-gray-500">
    Select a specific street address. This is shown on your listing and used to verify the location.
  </p>
  <AddressAutocomplete
    onSelect={handleAddressSelect}
    error={housingFields.addressError}
  />
  {previewCoords && housingFields.placeId && (
    <div className="mt-2">
      <p className="mb-1 text-xs text-gray-500">Preview — is this the right building?</p>
      <PropertyMap
        latitude={previewCoords.lat}
        longitude={previewCoords.lng}
        address={housingFields.addressLabel}
        height={220}
      />
    </div>
  )}
</div>
```

- [ ] **Step 7: Include placeId in the submit payload**

Find the form submit handler where the `housing` object is built for the API call. Add `placeId` to the submitted object:

```tsx
housing: {
  // ... existing fields ...
  placeId: housingFields.placeId,
},
```

- [ ] **Step 8: Handle submit-time address errors**

In the submit handler's catch block (where errors from the API are handled), detect the 400 address error and surface it on the field:

```tsx
} catch (err) {
  const message = err instanceof Error ? err.message : "Failed to create post";
  // If the error is about the address, show it under the address field
  if (/address|street|place/i.test(message)) {
    setHousingFields((prev) => ({ ...prev, addressError: message }));
  } else {
    // ... existing generic error handling ...
  }
}
```

Adapt to match the existing error handling pattern in the file.

- [ ] **Step 9: Client-side validation — block submit if placeId missing for housing**

In the submit handler, add at the top of the housing branch:

```tsx
if (postType === "housing" && !housingFields.placeId) {
  setHousingFields((prev) => ({
    ...prev,
    addressError: "Please select an address from the dropdown suggestions",
  }));
  return;
}
```

- [ ] **Step 10: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes.

- [ ] **Step 11: Manual QA**

Start the API and web dev servers in parallel. Open http://localhost:3001/create.

With a real browser key and server key:
1. Switch to housing post type
2. Type "1234 E 55th St" in the address field — verify dropdown appears with Chicago-area suggestions
3. Pick an address — verify the preview map renders with a pin on that building
4. Fill the rest of the form and submit — verify post creates successfully
5. Retry with invalid entry: type an address but don't pick from dropdown → click submit → verify error "Please select an address from the dropdown"
6. Retry with a city: type "Chicago, IL" → pick "Chicago, IL, USA" → submit → verify server rejects with "Please select a specific street address"

If no real keys available: verify at minimum that the field renders, the submit blocks when placeId is empty, and typecheck passes.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/create/page.tsx
git commit -m "feat(web): wire address autocomplete + preview map into create form"
```

---

### Task 6.2: Render map on detail page

**Files:**
- Modify: `apps/web/src/app/posts/[id]/client-page.tsx:509-630` (HousingDetailsSection)

- [ ] **Step 1: Add the import**

At the top of `apps/web/src/app/posts/[id]/client-page.tsx`:

```tsx
import { PropertyMap } from "@/components/housing/PropertyMap";
```

- [ ] **Step 2: Render PropertyMap inside HousingDetailsSection**

Find the `HousingDetailsSection` component (around line 509). Inside its JSX, after the amenities/neighborhood block but before the section closes, add:

```tsx
{housing.latitude != null && housing.longitude != null ? (
  <div className="mt-4">
    <h3 className="mb-2 text-sm font-semibold text-gray-700">Location</h3>
    <PropertyMap
      latitude={housing.latitude}
      longitude={housing.longitude}
      address={housing.address ?? undefined}
      height={320}
    />
    {housing.address && (
      <p className="mt-2 text-sm text-gray-600">{housing.address}</p>
    )}
  </div>
) : (
  <div className="mt-4 rounded-md bg-gray-50 p-3 text-xs text-gray-500">
    Exact location not available for this listing.
    {housing.neighborhood && ` Neighborhood: ${housing.neighborhood}.`}
  </div>
)}
```

Adjust the property access (`housing.latitude` etc.) to match the actual shape — the housing object may be accessed as `post.housing` depending on the parent component's prop naming. Read the section carefully to match.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes. If the housing type doesn't include the new fields, it's because the shared package types haven't been regenerated — run `pnpm -w build` from the project root to rebuild all workspace packages.

- [ ] **Step 4: Manual QA**

Create a housing post (via Task 6.1 flow), then open its detail page. Verify:
- Map renders with the pin on the correct building
- Address text appears below the map
- Clicking the pin shows the address in an info window

Then open a legacy housing post (one created before the feature): verify the fallback "Exact location not available" note appears instead of the map.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/posts/\[id\]/client-page.tsx
git commit -m "feat(web): render property map on housing detail page"
```

---

### Task 6.3: Integrate address into edit page

**Files:**
- Modify: `apps/web/src/app/posts/[id]/edit/page.tsx`

- [ ] **Step 1: Read the current edit page**

Read `apps/web/src/app/posts/[id]/edit/page.tsx` to understand its structure — it likely mirrors the create page with pre-filled values.

- [ ] **Step 2: Apply the same integration as Task 6.1**

Mirror Task 6.1 steps 3-9 in the edit page:
- Add imports for `AddressAutocomplete`, `PropertyMap`, `useGoogleMaps`
- Add `previewCoords` state
- Initialize `placeId`, `addressLabel`, `addressError` from the loaded post's existing housing data (pre-fill)
- Add `handleAddressSelect` (identical to create)
- Render the address field + preview map in the housing section
- Block submit if `placeId` is missing AND the post's existing housing lacks one (legacy case)
- Include `placeId` in the PATCH payload when it differs from the loaded value

**Legacy post notice:** if the loaded post's `housing.placeId` is null, show a banner above the housing fields:

```tsx
{isLegacyHousingPost && (
  <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
    Please add a verified address to continue editing this listing. This is required to keep the listing active.
  </div>
)}
```

Where `isLegacyHousingPost = post.type === "housing" && !post.housing?.placeId`.

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes.

- [ ] **Step 4: Manual QA**

1. Open a housing post created in Task 6.1 → edit → verify current address shows as the input's initial value, preview map renders
2. Pick a different address → verify preview updates → save → verify detail page shows new address
3. Open a legacy housing post → edit → verify amber notice appears, address field is empty, submit blocked until address is selected

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/posts/\[id\]/edit/page.tsx
git commit -m "feat(web): require verified address on housing edit, nudge legacy posts"
```

---

### Task 6.4: Browse page list/map toggle

**Files:**
- Modify: `apps/web/src/app/browse/page.tsx`

- [ ] **Step 1: Read current browse page structure**

Read `apps/web/src/app/browse/page.tsx` to understand the existing list rendering.

- [ ] **Step 2: Add imports**

```tsx
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { HousingMapView, type HousingMapPost } from "@/components/housing/HousingMapView";
```

- [ ] **Step 3: Read view state from URL and add a toggle**

Inside the component, add:

```tsx
const searchParams = useSearchParams();
const router = useRouter();
const pathname = usePathname();
const view = searchParams.get("view") === "map" ? "map" : "list";
const isHousingCategory = searchParams.get("type") === "housing";

const [mapPosts, setMapPosts] = useState<HousingMapPost[]>([]);
const [mapLoading, setMapLoading] = useState(false);
const [mapError, setMapError] = useState<string | null>(null);

function setView(nextView: "list" | "map") {
  const params = new URLSearchParams(searchParams.toString());
  if (nextView === "map") {
    params.set("view", "map");
  } else {
    params.delete("view");
  }
  router.replace(`${pathname}?${params.toString()}`);
}

useEffect(() => {
  if (view !== "map" || !isHousingCategory) return;

  setMapLoading(true);
  setMapError(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  fetch(`${apiUrl}/api/posts/housing/map`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: { posts: HousingMapPost[] }) => {
      setMapPosts(data.posts);
    })
    .catch((err) => {
      setMapError(err instanceof Error ? err.message : "Failed to load map");
    })
    .finally(() => setMapLoading(false));
}, [view, isHousingCategory]);
```

- [ ] **Step 4: Render the toggle buttons (housing category only)**

Inside the JSX, above the results area, add:

```tsx
{isHousingCategory && (
  <div className="mb-4 inline-flex rounded-md border border-gray-300 bg-white p-1">
    <button
      type="button"
      onClick={() => setView("list")}
      className={`rounded px-4 py-1.5 text-sm font-medium transition ${
        view === "list" ? "bg-maroon-600 text-white" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      List
    </button>
    <button
      type="button"
      onClick={() => setView("map")}
      className={`rounded px-4 py-1.5 text-sm font-medium transition ${
        view === "map" ? "bg-maroon-600 text-white" : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      Map
    </button>
  </div>
)}
```

- [ ] **Step 5: Conditionally render the map vs list**

Wrap the existing list render so that when `view === "map" && isHousingCategory`, the `HousingMapView` renders instead:

```tsx
{view === "map" && isHousingCategory ? (
  mapLoading ? (
    <div className="flex h-[600px] items-center justify-center">Loading map…</div>
  ) : mapError ? (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
      Failed to load map: {mapError}
    </div>
  ) : (
    <HousingMapView
      posts={mapPosts}
      onPinClick={(postId) => router.push(`/posts/${postId}`)}
    />
  )
) : (
  // ... existing list rendering ...
)}
```

- [ ] **Step 6: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: passes.

- [ ] **Step 7: Manual QA**

1. Navigate to `/browse?type=housing` → verify List/Map toggle appears
2. Click "Map" → URL becomes `/browse?type=housing&view=map` → map loads with pins for any posts that have verified addresses
3. Click a pin → info window opens with thumbnail, title, rent, "View listing" link
4. Click "View listing" → navigates to the post detail page
5. Click "List" → URL loses `view=map` → list view returns
6. Navigate to `/browse?type=marketplace` → verify toggle is hidden (housing-only feature)
7. With no housing posts yet, map view shows empty state

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/browse/page.tsx
git commit -m "feat(web): add housing list/map toggle with clustered map view"
```

---

## Phase 7: End-to-End Manual QA

### Task 7.1: Full smoke test against the manual QA checklist

- [ ] **Step 1: Ensure both servers are running with real Google Cloud keys**

- Browser key: `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` in `apps/web/.env.local`, restricted to `localhost:3001/*`
- Server key: `GOOGLE_PLACES_SERVER_KEY` in `apps/api/.env` (unrestricted for dev)
- Enable APIs in Google Cloud: Maps JavaScript API, Places API (New)

- [ ] **Step 2: Walk through the QA checklist from the spec**

Run through each manual QA step from the design spec:

1. Create a housing post with a real Chicago address — verify map preview pin is correct, detail page pin is correct
2. Try to submit without picking from dropdown → verify error "Please select an address from the dropdown"
3. Try to pick a city ("Chicago, IL") — verify server rejects with "Please select a specific street address"
4. Try an address outside Chicago (e.g., NYC address with ZIP 10001) — verify server rejects with "Address must be in the Chicago area"
5. View a legacy post (no coords) — verify no map, shows "Exact location not available" note
6. Browse page → toggle to map → verify clusters render (create 5+ housing posts first if needed), click through to a listing
7. Disconnect network mid-create → verify graceful error, form state preserved
8. Edit a legacy housing post → verify amber notice, address required to save

- [ ] **Step 3: Fix any QA findings**

If a QA step fails, create an in-session fix commit with a clear message referencing the failing step. Re-run the full QA checklist after fixing.

- [ ] **Step 4: Run final typecheck across the monorepo**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart && pnpm -w typecheck
```

Expected: no errors across apps/api, apps/web, packages/shared.

- [ ] **Step 5: Run final backend tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests green.

- [ ] **Step 6: Commit any final fixes**

If nothing changed during QA, no commit needed. Otherwise:

```bash
git add -A
git commit -m "fix(housing): QA cleanup for address verification"
```

---

## Completion Checklist

At the end, you should have:

- [ ] New Prisma columns on `housing_details`: `address`, `latitude`, `longitude`, `place_id`
- [ ] `geocoding.service.ts` with ≥ 9 passing tests
- [ ] `posts.service.ts` with updated create + update logic and ≥ 9 passing tests
- [ ] New `GET /api/posts/housing/map` endpoint
- [ ] Two Google Cloud API keys documented in `.env.example` (browser + server)
- [ ] 4 new React components under `apps/web/src/components/housing/`
- [ ] Create page, edit page, detail page, browse page all integrated
- [ ] Full manual QA checklist passed
- [ ] All typecheck + tests green
- [ ] All commits land cleanly on the feature branch
