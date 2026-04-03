# Mobile Phase 2: Posts CRUD + Housing

Design spec for mobile tasks 2.12 (Create Post), 2.13 (Browse Feed), 2.14 (Post Detail), plus the new Housing vertical (sublets & passdowns).

## Context

- **Platform**: Expo SDK 54, Expo Router v6, React Native 0.81, React 19, New Architecture enabled
- **API**: Existing REST API at `apps/api/` with full posts CRUD, image upload, JWT auth (Google OAuth + `@uchicago.edu` enforcement)
- **Shared package**: `@uchicago-marketplace/shared` — Zod schemas, TypeScript types, `ApiClient` class (baseUrl + getToken pattern)
- **Styling**: Vanilla `StyleSheet.create` (no UI library installed)
- **Current state**: Stock Expo Router tab template, no product screens

## Design Decisions

### Navigation: Separate Tabs per Vertical

Tab bar with 5 items:

| Position | Tab | Icon | Notes |
|----------|-----|------|-------|
| 1 | Marketplace | Store icon | Marketplace posts feed |
| 2 | Storage | Box icon | Storage posts feed |
| 3 | Post | Center FAB (raised maroon circle with +) | Create post wizard |
| 4 | Housing | House icon | Sublets & passdowns feed |
| 5 | Profile | Person icon | User profile (placeholder for Phase 1 auth) |

Rationale: Separate tabs scale as verticals are added. Each tab owns its own feed, filters, and search. The center FAB is visually elevated with a maroon gradient and shadow.

### Color System by Vertical

Each vertical has a distinct accent color used for price text, active filter chips, CTAs, and badges:

| Vertical | Accent | Hex |
|----------|--------|-----|
| Marketplace | Maroon | `#800000` |
| Storage | Amber | `#b45309` |
| Housing | Indigo | `#6366f1` |

Neutral UI (cards, backgrounds, text) uses a shared gray/white palette. The maroon brand color remains dominant in the tab bar, status bar, and Create FAB across all tabs.

### Browse Feed: Medium-Density List Cards

Each feed tab (Marketplace, Storage, Housing) uses the same card layout structure:

**Card anatomy (left to right):**
- **Left**: 88x88 rounded thumbnail image
- **Right**: Title (semibold 13px), price (bold 15px in accent color), badge row (condition/category/size/amenities), author line with star rating + time ago

**Feed header (top of each tab):**
- Tab title (bold 18px)
- Search bar (rounded, placeholder text)
- Horizontally scrollable filter chips (category, side, etc.)
- Item count + sort dropdown ("Sort: Recent")

**Feed behaviors:**
- Pull-to-refresh: refetch first page
- Infinite scroll: append next page on scroll to bottom
- Loading: skeleton loaders matching card dimensions (animated pulse)
- Empty: branded illustration + "Be the first Maroon to post!" + CTA button
- Error: friendly message ("Campus WiFi strikes again...") + retry button

### Marketplace Feed Specifics

**Filter chips**: All | Textbooks | Electronics | Furniture | Clothing | Free | ...
(Categories sourced from shared constants, not hardcoded in the mobile app)

**Card badges**: condition (Like New, Good, Fair, etc.) + category

**Price display**: `$25` for fixed, `Free` for free, `Trade` for trade

**Sort options**: Recent | Price: Low to High | Price: High to Low

### Storage Feed Specifics

**Filter chips**: All | Has Space | Need Storage | On Campus | Off Campus

**Card badges**: size (Boxes, Half Room, Full Room) + location type (On/Off Campus)

**Price display**: `$60/mo` for paid, `Free` for free

**Additional card line**: date range (e.g., "Jun 15 - Sep 1")

### Housing Feed Specifics

**Segmented control** at top of feed toggles between Sublets and Passdowns. This is a hard switch that changes the API query filter, not a soft filter chip.

**Filter chips (both subtypes)**: All | Offering | Looking | Studio | 1BR+ | 2BR+

**Card badges**: bedroom/bathroom count + amenity tags (Furnished, AC, Parking, Laundry, Pets)

**Sublet cards**: monthly rent, move-in/move-out date range
**Passdown cards**: monthly rent, lease start + duration (e.g., "Lease starts Sep 1 - 12 months")

### Post Detail: Image-Hero Layout

Shared layout across all post types:

1. **Navigation bar**: back button + overflow menu (edit/delete for owner)
2. **Image carousel**: full-width, swipeable, dot indicators. Aspect ratio 4:3.
3. **Title + price**: title bold 18px, price bold 22px in accent color
4. **Save button**: heart icon, top-right of title area
5. **Badge row**: type-specific badges (same as feed card)
6. **Type-specific info block** (housing only): 2x2 grid showing move-in, move-out, roommates, location
7. **Description**: body text
8. **Author card**: avatar circle (initials), name, star rating, verified badge, time ago
9. **CTA buttons**: "Message [Seller/Host]" (primary, full-width gradient) + "Save" (outlined)

Owner view: shows Edit and Delete in overflow menu instead of Message/Save CTAs.

### Create Post Wizard: 5-Step Flow

Universal flow regardless of entry point:

**Step 1 — Photos**
- Camera + photo library picker (using `expo-image-picker`)
- Grid of selected thumbnails with delete/reorder
- Up to 8 photos (from `APP_CONFIG.maxImagesPerPost`)
- Optional for all post types (skip link available), encouraged for marketplace/housing
- Photos are held in local state during the wizard, then uploaded via `POST /api/posts/:id/images` after the post is created in Step 5

**Step 2 — Type**
- Three large tile buttons: Marketplace, Storage, Housing
- Each tile has icon + label + short description
- Housing selection reveals a sub-selector: Sublet or Passdown

**Step 3 — Basic Info**
- Title input (max 80 chars, live character counter)
- Description textarea (optional)

**Step 4 — Type-Specific Fields**

*Marketplace:*
- Side toggle: Selling / Buying
- Category picker (from shared constants)
- Condition picker (New, Like New, Good, Fair, For Parts)
- Price type toggle: Fixed / Free / Trade
- Price amount input (shown only when Fixed)
- Trade description (shown only when Trade)
- Tags input (comma-separated)

*Storage:*
- Side toggle: Has Space / Need Storage
- Start date + End date pickers
- Size picker: Boxes / Half Room / Full Room
- Location toggle: On Campus / Off Campus
- Neighborhood text input
- Free checkbox + monthly price input (hidden when free)
- Restrictions textarea

*Housing (Sublet):*
- Side toggle: Offering / Looking
- Monthly rent input
- Move-in date + Move-out date pickers
- Bedrooms picker: Studio / 1 / 2 / 3+
- Bathrooms picker: 1 / 1.5 / 2+
- Location/neighborhood text input
- Amenities multi-select: Furnished, In-Unit Laundry, Parking, AC, Pets Allowed, Dishwasher, Gym
- Roommates: Solo / Shared (with count)

*Housing (Passdown):*
- Side toggle: Offering / Looking
- Monthly rent input
- Lease start date picker
- Lease duration picker: 6 / 9 / 11 / 12 months / Other
- Bedrooms, Bathrooms, Location, Amenities, Roommates (same as sublet)

**Step 5 — Review**
- Read-only summary of all fields
- Photo thumbnails at top
- Edit buttons per section to jump back
- "Publish Post" CTA (maroon gradient)

**Step progress indicator**: horizontal bar with numbered circles. Completed steps show checkmarks and are tappable to go back. Active step is maroon. Future steps are gray.

**Validation gates** (cannot advance until satisfied):
- Step 1→2: photos are optional (user can skip with a "Skip for now" link). No minimum required.
- Step 2→3: type selected (and subtype for housing)
- Step 3→4: title is 1-80 characters
- Step 4→5: all required fields filled (varies by type)

### API Integration

**Use the shared `ApiClient`** from `@uchicago-marketplace/shared`:
- Instantiate with `baseUrl` from environment config and `getToken` from auth context
- All API calls go through this client — no raw `fetch`

**TODO (future)**: Evaluate building a mobile-specific API layer on top of the shared client for offline caching, retry logic on flaky campus WiFi, and optimistic updates. Track in `planning/implementation.md`.

**TODO (web tech debt)**: Migrate web app from raw `fetch` to the shared `ApiClient`. Currently duplicated in 6+ files. Track in `planning/implementation.md`.

### Branded Loading & Empty States

**Skeleton loaders**: match card shape — 88x88 rounded rect on left, three horizontal bars on right. Animated pulse (gray shimmer). Show 4-5 skeleton cards while loading.

**Empty states** per tab:
- Marketplace: "Nothing for sale yet — be the first Maroon to list!"
- Storage: "No storage posts yet — got space to share?"
- Housing: "No housing posts yet — help a fellow Maroon find a home!"

Each empty state has an icon/illustration, warm copy, and a "Create a Post" CTA button.

**Error states**: friendly copy ("Something went wrong — campus WiFi strikes again...") + "Try Again" button. Maroon-accented.

### Data Model: Housing Extension

New post type `housing` with subtypes `sublet` and `passdown`. Follows the existing polymorphic pattern (like `marketplace` → `MarketplaceDetails`, `storage` → `StorageDetails`).

**New `HousingDetails` table (1-1 with Post):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | PK | |
| `postId` | UUID | FK → posts | |
| `subtype` | Enum: `sublet`, `passdown` | Yes | |
| `side` | Enum: `offering`, `looking` | Yes | |
| `monthlyRent` | Float | Yes | |
| `bedrooms` | Enum: `studio`, `1`, `2`, `3_plus` | Yes | |
| `bathrooms` | Enum: `1`, `1.5`, `2_plus` | Yes | |
| `neighborhood` | String | No | |
| `amenities` | String[] | No | Multi-select tags |
| `roommates` | Enum: `solo`, `shared` | Yes | |
| `roommateCount` | Int | No | Only when shared |
| `moveInDate` | DateTime | Sublet only | |
| `moveOutDate` | DateTime | Sublet only | |
| `leaseStartDate` | DateTime | Passdown only | |
| `leaseDurationMonths` | Int | Passdown only | |
| `createdAt` | DateTime | Auto | |
| `updatedAt` | DateTime | Auto | |

**Post model changes:**
- `type` enum: add `housing`
- `side` enum: add `offering`, `looking`

**Shared types/schemas changes:**
- Add `HousingDetails` interface
- Add `housing` branch to `createPostSchema` discriminated union
- Add `subtype`, `amenities`, `bedrooms`, `bathrooms` to `postQuerySchema`
- Add housing constants (amenities list, bedroom options, etc.)

**API changes:**
- Posts service: handle `housing` type in create/update/list/detail
- Join `housing_details` in queries when `type === 'housing'`
- Filter support for housing-specific fields

### File Structure (Mobile)

```
apps/mobile/
  app/
    _layout.tsx                    -- Root layout (Stack)
    (tabs)/
      _layout.tsx                  -- Tab navigator (5 tabs)
      marketplace.tsx              -- Marketplace feed screen
      storage.tsx                  -- Storage feed screen
      housing.tsx                  -- Housing feed screen (segmented)
      create.tsx                   -- Create post wizard
      profile.tsx                  -- Profile placeholder
    posts/
      [id].tsx                     -- Post detail screen (push from feed)
  components/
    PostCard.tsx                   -- Shared card component (all types)
    PostCardSkeleton.tsx           -- Skeleton loader matching card shape
    EmptyState.tsx                 -- Branded empty state (icon + copy + CTA)
    ErrorState.tsx                 -- Error state with retry
    ImageCarousel.tsx              -- Swipeable image carousel for detail
    FilterChips.tsx                -- Horizontal scrollable filter chips
    SearchBar.tsx                  -- Search input component
    StepIndicator.tsx              -- Wizard step progress bar
    TypeSelector.tsx               -- Type selection tiles (Step 2)
    ImagePicker.tsx                -- Photo picker + grid (Step 1)
    BadgeRow.tsx                   -- Renders type-specific badge array
    AuthorRow.tsx                  -- Author name + stars + time
    SegmentedControl.tsx           -- Toggle for sublets/passdowns
    SortPicker.tsx                 -- Sort dropdown/bottom sheet
  hooks/
    usePostsFeed.ts                -- Infinite scroll + pull-to-refresh + filtering
    useCreatePost.ts               -- Wizard state management
    usePostDetail.ts               -- Fetch single post
    useAuth.ts                     -- Auth context hook (token management)
    useApiClient.ts                -- Shared ApiClient instance
  constants/
    colors.ts                      -- Color system (maroon, amber, indigo + neutrals)
    typography.ts                  -- Font sizes, weights, families
  types/
    navigation.ts                  -- Route param types
  lib/
    api.ts                         -- ApiClient instantiation + config
```

### What's NOT in Scope

- Auth flow (Phase 1) — Profile tab will be a placeholder
- Messaging (Phase 4) — "Message Seller" button will be disabled with tooltip
- Save/favorite functionality (Phase 3) — Save button will be disabled
- Star ratings system — the UI will show star ratings on cards and detail views, but with no data (hidden/omitted until the ratings API exists in a future phase). No hardcoded fake ratings.
- Edit/delete post from mobile — detail screen will show the buttons for post owners, but the edit flow is deferred
