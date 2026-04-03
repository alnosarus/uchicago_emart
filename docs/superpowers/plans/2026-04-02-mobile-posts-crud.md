# Mobile Phase 2: Posts CRUD + Housing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build mobile browse feeds (Marketplace, Storage, Housing), post detail screen, and 5-step create wizard, plus extend the backend to support the new Housing vertical.

**Architecture:** Expo Router file-based navigation with 5 tabs. Shared `ApiClient` for all API calls. Reusable components (`PostCard`, `FilterChips`, etc.) shared across feed tabs. Housing extends the existing polymorphic post pattern (new `housing_details` table + Prisma relation).

**Tech Stack:** Expo SDK 54, Expo Router v6, React Native 0.81, TypeScript, Prisma, Zod, `@uchicago-marketplace/shared`

---

## File Map

### Backend (Prisma + API)
- Modify: `apps/api/prisma/schema.prisma` — add housing enums + `HousingDetails` model
- Modify: `apps/api/src/services/posts.service.ts` — add housing branching in CRUD
- Modify: `apps/api/src/routes/posts.ts` — no changes needed (generic validation)

### Shared Package
- Modify: `packages/shared/src/types/post.ts` — add housing types
- Modify: `packages/shared/src/schemas/post.schema.ts` — add housing branch to discriminated union + query filters
- Modify: `packages/shared/src/constants/categories.ts` — add housing constants
- Modify: `packages/shared/src/api-client/posts.ts` — add image upload method

### Mobile — Foundation
- Rewrite: `apps/mobile/constants/Colors.ts` → `apps/mobile/constants/colors.ts` — brand color system
- Create: `apps/mobile/constants/typography.ts` — font sizes/weights
- Create: `apps/mobile/lib/api.ts` — ApiClient instantiation
- Create: `apps/mobile/hooks/useAuth.ts` — auth context placeholder (token management)
- Create: `apps/mobile/hooks/useApiClient.ts` — hook wrapping shared ApiClient

### Mobile — Navigation
- Modify: `apps/mobile/app/_layout.tsx` — wrap in AuthProvider
- Rewrite: `apps/mobile/app/(tabs)/_layout.tsx` — 5-tab layout with center FAB
- Create: `apps/mobile/app/(tabs)/marketplace.tsx`
- Create: `apps/mobile/app/(tabs)/storage.tsx`
- Create: `apps/mobile/app/(tabs)/housing.tsx`
- Create: `apps/mobile/app/(tabs)/create.tsx`
- Create: `apps/mobile/app/(tabs)/profile.tsx`
- Delete: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/two.tsx`
- Create: `apps/mobile/app/posts/[id].tsx` — detail screen (Stack push)

### Mobile — Components
- Create: `apps/mobile/components/PostCard.tsx` — medium-density list card
- Create: `apps/mobile/components/PostCardSkeleton.tsx` — animated skeleton
- Create: `apps/mobile/components/EmptyState.tsx` — branded empty
- Create: `apps/mobile/components/ErrorState.tsx` — error with retry
- Create: `apps/mobile/components/ImageCarousel.tsx` — swipeable hero images
- Create: `apps/mobile/components/FilterChips.tsx` — horizontal scrollable chips
- Create: `apps/mobile/components/SearchBar.tsx` — search input
- Create: `apps/mobile/components/SegmentedControl.tsx` — sublet/passdown toggle
- Create: `apps/mobile/components/SortPicker.tsx` — sort bottom sheet
- Create: `apps/mobile/components/BadgeRow.tsx` — type-specific badges
- Create: `apps/mobile/components/AuthorRow.tsx` — author + stars + time
- Create: `apps/mobile/components/StepIndicator.tsx` — wizard progress bar
- Create: `apps/mobile/components/TypeSelector.tsx` — type tile picker
- Create: `apps/mobile/components/ImagePickerGrid.tsx` — photo picker + grid

### Mobile — Hooks
- Create: `apps/mobile/hooks/usePostsFeed.ts` — infinite scroll + refresh + filtering
- Create: `apps/mobile/hooks/usePostDetail.ts` — fetch single post
- Create: `apps/mobile/hooks/useCreatePost.ts` — wizard state machine

---

## Task 1: Housing DB Schema + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add housing enums to Prisma schema**

Add after the existing `LocationType` enum in `apps/api/prisma/schema.prisma`:

```prisma
enum HousingSubtype {
  sublet
  passdown
}

enum HousingSide {
  offering
  looking
}

enum Bedrooms {
  studio
  one     @map("1")
  two     @map("2")
  three_plus @map("3_plus")
}

enum Bathrooms {
  one        @map("1")
  one_half   @map("1.5")
  two_plus   @map("2_plus")
}

enum RoommateType {
  solo
  shared
}
```

- [ ] **Step 2: Add HousingDetails model**

Add after the `StorageDetails` model:

```prisma
model HousingDetails {
  postId             String        @id @default(uuid()) @db.Uuid
  post               Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  subtype            HousingSubtype
  side               HousingSide
  monthlyRent        Float
  bedrooms           Bedrooms
  bathrooms          Bathrooms
  neighborhood       String?
  amenities          String[]      @default([])
  roommates          RoommateType
  roommateCount      Int?
  // Sublet-specific
  moveInDate         DateTime?
  moveOutDate        DateTime?
  // Passdown-specific
  leaseStartDate     DateTime?
  leaseDurationMonths Int?

  @@map("housing_details")
}
```

- [ ] **Step 3: Update Post model for housing**

In the `PostType` enum, add `housing`:

```prisma
enum PostType {
  marketplace
  storage
  housing
}
```

In the `PostSide` enum, add housing sides:

```prisma
enum PostSide {
  sell
  buy
  has_space
  need_storage
  offering
  looking
}
```

In the `Post` model, add the housing relation alongside the existing ones:

```prisma
model Post {
  // ... existing fields ...
  marketplace   MarketplaceDetails?
  storage       StorageDetails?
  housing       HousingDetails?      // ADD THIS LINE
  // ... rest of relations ...
}
```

- [ ] **Step 4: Run migration**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart
pnpm db:migrate --name add_housing_details
```

Expected: Migration creates `housing_details` table and updates enums.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add housing_details schema with sublet/passdown support"
```

---

## Task 2: Shared Types — Housing

**Files:**
- Modify: `packages/shared/src/types/post.ts`

- [ ] **Step 1: Add housing type aliases**

Add after the existing type aliases in `packages/shared/src/types/post.ts`:

```ts
export type HousingSubtype = "sublet" | "passdown";
export type HousingSide = "offering" | "looking";
export type Bedrooms = "studio" | "1" | "2" | "3_plus";
export type Bathrooms = "1" | "1.5" | "2_plus";
export type RoommateType = "solo" | "shared";
```

- [ ] **Step 2: Update PostType and PostSide to include housing**

Change the existing type aliases:

```ts
export type PostType = "marketplace" | "storage" | "housing";
export type PostSide = "sell" | "buy" | "has_space" | "need_storage" | "offering" | "looking";
```

- [ ] **Step 3: Add HousingDetails interface**

Add after `StorageDetails`:

```ts
export interface HousingDetails {
  postId: string;
  subtype: HousingSubtype;
  side: HousingSide;
  monthlyRent: number;
  bedrooms: Bedrooms;
  bathrooms: Bathrooms;
  neighborhood: string | null;
  amenities: string[];
  roommates: RoommateType;
  roommateCount: number | null;
  moveInDate: Date | null;
  moveOutDate: Date | null;
  leaseStartDate: Date | null;
  leaseDurationMonths: number | null;
}
```

- [ ] **Step 4: Update PostWithDetails to include housing**

```ts
export interface PostWithDetails extends Post {
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  marketplace?: MarketplaceDetails;
  storage?: StorageDetails;
  housing?: HousingDetails;
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types/post.ts
git commit -m "feat: add housing types to shared package"
```

---

## Task 3: Shared Schemas — Housing

**Files:**
- Modify: `packages/shared/src/schemas/post.schema.ts`

- [ ] **Step 1: Add housing enums and details schema**

Add after `storageDetailsSchema` in `packages/shared/src/schemas/post.schema.ts`:

```ts
const housingSubtypeEnum = z.enum(["sublet", "passdown"]);
const housingSideEnum = z.enum(["offering", "looking"]);
const bedroomsEnum = z.enum(["studio", "1", "2", "3_plus"]);
const bathroomsEnum = z.enum(["1", "1.5", "2_plus"]);
const roommateTypeEnum = z.enum(["solo", "shared"]);

export const housingDetailsSchema = z.object({
  subtype: housingSubtypeEnum,
  side: housingSideEnum,
  monthlyRent: z.number().min(0),
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
});
```

- [ ] **Step 2: Add housing branch to createPostSchema**

Update the `createPostSchema` discriminated union — add a third branch:

```ts
export const createPostSchema = z.discriminatedUnion("type", [
  z.object({
    type:        z.literal("marketplace"),
    side:        z.enum(["sell", "buy"]),
    title:       z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    marketplace: marketplaceDetailsSchema,
  }),
  z.object({
    type:        z.literal("storage"),
    side:        z.enum(["has_space", "need_storage"]),
    title:       z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    storage:     storageDetailsSchema,
  }),
  z.object({
    type:        z.literal("housing"),
    side:        z.enum(["offering", "looking"]),
    title:       z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    housing:     housingDetailsSchema,
  }),
]);
```

- [ ] **Step 3: Update postQuerySchema for housing filters**

Add housing-specific query params. Update the `postTypeEnum` and `postSideEnum` first:

```ts
const postTypeEnum     = z.enum(["marketplace", "storage", "housing"]);
const postSideEnum     = z.enum(["sell", "buy", "has_space", "need_storage", "offering", "looking"]);
```

Then add housing filter fields to `postQuerySchema`:

```ts
export const postQuerySchema = z.object({
  type:         postTypeEnum.optional(),
  side:         postSideEnum.optional(),
  q:            z.string().optional(),
  category:     z.string().optional(),
  size:         storageSizeEnum.optional(),
  locationType: locationTypeEnum.optional(),
  priceMin:     z.coerce.number().min(0).optional(),
  priceMax:     z.coerce.number().min(0).optional(),
  condition:    conditionEnum.optional(),
  // Housing filters
  subtype:      housingSubtypeEnum.optional(),
  bedrooms:     bedroomsEnum.optional(),
  bathrooms:    bathroomsEnum.optional(),
  sort:         z.enum(["recent", "price_asc", "price_desc", "relevance"]).default("recent"),
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(50).default(20),
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/post.schema.ts
git commit -m "feat: add housing schemas and query filters to shared package"
```

---

## Task 4: Shared Constants — Housing

**Files:**
- Modify: `packages/shared/src/constants/categories.ts`

- [ ] **Step 1: Add housing constants**

Add at the end of `packages/shared/src/constants/categories.ts`:

```ts
export const HOUSING_AMENITIES = [
  { value: "furnished",       label: "Furnished" },
  { value: "in_unit_laundry", label: "In-Unit Laundry" },
  { value: "parking",         label: "Parking" },
  { value: "ac",              label: "AC" },
  { value: "pets_allowed",    label: "Pets Allowed" },
  { value: "dishwasher",      label: "Dishwasher" },
  { value: "gym",             label: "Gym" },
] as const;

export const BEDROOM_OPTIONS = [
  { value: "studio",    label: "Studio" },
  { value: "1",         label: "1 Bedroom" },
  { value: "2",         label: "2 Bedrooms" },
  { value: "3_plus",    label: "3+ Bedrooms" },
] as const;

export const BATHROOM_OPTIONS = [
  { value: "1",      label: "1 Bath" },
  { value: "1.5",    label: "1.5 Bath" },
  { value: "2_plus", label: "2+ Bath" },
] as const;

export const LEASE_DURATION_OPTIONS = [
  { value: 6,  label: "6 months" },
  { value: 9,  label: "9 months" },
  { value: 11, label: "11 months" },
  { value: 12, label: "12 months" },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/constants/categories.ts
git commit -m "feat: add housing constants (amenities, bedrooms, bathrooms, lease durations)"
```

---

## Task 5: API Service — Housing Support

**Files:**
- Modify: `apps/api/src/services/posts.service.ts`

- [ ] **Step 1: Update createPost to handle housing type**

In the `createPost` function, add housing branching alongside the existing marketplace/storage pattern. Find the `prisma.post.create` call and add:

```ts
...(input.housing && {
  housing: {
    create: {
      subtype: input.housing.subtype,
      side: input.housing.side,
      monthlyRent: input.housing.monthlyRent,
      bedrooms: input.housing.bedrooms,
      bathrooms: input.housing.bathrooms,
      neighborhood: input.housing.neighborhood ?? null,
      amenities: input.housing.amenities ?? [],
      roommates: input.housing.roommates,
      roommateCount: input.housing.roommateCount ?? null,
      moveInDate: input.housing.moveInDate ? new Date(input.housing.moveInDate) : null,
      moveOutDate: input.housing.moveOutDate ? new Date(input.housing.moveOutDate) : null,
      leaseStartDate: input.housing.leaseStartDate ? new Date(input.housing.leaseStartDate) : null,
      leaseDurationMonths: input.housing.leaseDurationMonths ?? null,
    },
  },
}),
```

Also add `housing: true` to the `include` block in the `create` call (alongside `marketplace: true` and `storage: true`).

- [ ] **Step 2: Update listPosts to include housing and filter**

In the `listPosts` function:

1. Add `housing: true` to the `include` block.

2. Add housing-specific filtering (same pattern as marketplace/storage):

```ts
// Housing filters
if (input.subtype || input.bedrooms || input.bathrooms || input.priceMin !== undefined || input.priceMax !== undefined) {
  const housingWhere: Record<string, unknown> = {};
  if (input.subtype) housingWhere.subtype = input.subtype;
  if (input.bedrooms) housingWhere.bedrooms = input.bedrooms;
  if (input.bathrooms) housingWhere.bathrooms = input.bathrooms;
  if (input.priceMin !== undefined || input.priceMax !== undefined) {
    housingWhere.monthlyRent = {
      ...(input.priceMin !== undefined && { gte: input.priceMin }),
      ...(input.priceMax !== undefined && { lte: input.priceMax }),
    };
  }
  if (Object.keys(housingWhere).length > 0) {
    where.housing = housingWhere;
  }
}
```

3. Add `price_asc`/`price_desc` sort handling for housing (sort on `housing.monthlyRent`):

In the sort switch, housing prices sort on `housing: { monthlyRent: "asc" | "desc" }`. Since only one type's relation will be non-null per post, add the housing sort alongside the marketplace sort.

- [ ] **Step 3: Update getPostById to include housing**

Add `housing: true` to the `include` block in `getPostById`.

- [ ] **Step 4: Update updatePost to handle housing**

Add housing update branching, same pattern as marketplace/storage:

```ts
...(input.housing && {
  housing: {
    update: {
      ...input.housing,
      ...(input.housing.moveInDate && { moveInDate: new Date(input.housing.moveInDate) }),
      ...(input.housing.moveOutDate && { moveOutDate: new Date(input.housing.moveOutDate) }),
      ...(input.housing.leaseStartDate && { leaseStartDate: new Date(input.housing.leaseStartDate) }),
    },
  },
}),
```

Also add `housing: true` to the `include` block.

- [ ] **Step 5: Verify API builds**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart
pnpm --filter @uchicago-marketplace/shared run build
pnpm --filter @uchicago-marketplace/api run build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/posts.service.ts
git commit -m "feat: add housing support to posts service (create, list, detail, update)"
```

---

## Task 6: Build Shared Package + Add Image Upload to API Client

**Files:**
- Modify: `packages/shared/src/api-client/posts.ts`

- [ ] **Step 1: Add uploadImages method to posts API client**

The mobile app needs to upload images after creating a post. Add to `createPostsApi` in `packages/shared/src/api-client/posts.ts`:

```ts
async uploadImages(postId: string, formData: FormData): Promise<{ urls: string[] }> {
  const token = client["getToken"]();
  const response = await fetch(`${client["baseUrl"]}/api/posts/${postId}/images`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Upload failed" }));
    throw new ApiError(response.status, error.message);
  }
  return response.json();
},
```

Note: This bypasses `client.request()` because image upload needs `FormData` (no `Content-Type: application/json`).

Import `ApiError` at the top of the file:
```ts
import { ApiClient, ApiError } from "./client";
```

- [ ] **Step 2: Expose baseUrl and getToken on ApiClient**

The `uploadImages` method needs access to `baseUrl` and `getToken`. Make them accessible by changing from `private` to `public readonly` in `packages/shared/src/api-client/client.ts`:

```ts
export class ApiClient {
  public readonly baseUrl: string;
  public readonly getToken: () => string | null;
```

- [ ] **Step 3: Update uploadImages to use public fields**

Now update the `uploadImages` method to use `client.baseUrl` and `client.getToken()` instead of the bracket notation:

```ts
async uploadImages(postId: string, formData: FormData): Promise<{ urls: string[] }> {
  const token = client.getToken();
  const response = await fetch(`${client.baseUrl}/api/posts/${postId}/images`, {
```

- [ ] **Step 4: Build shared package**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart
pnpm --filter @uchicago-marketplace/shared run build
```

Expected: Build succeeds with `dist/` output.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/
git commit -m "feat: add housing types/schemas/constants + image upload to shared API client"
```

---

## Task 7: Mobile Foundation — Colors, Typography, API Client

**Files:**
- Rewrite: `apps/mobile/constants/Colors.ts` → `apps/mobile/constants/colors.ts`
- Create: `apps/mobile/constants/typography.ts`
- Create: `apps/mobile/lib/api.ts`
- Create: `apps/mobile/hooks/useAuth.ts`

- [ ] **Step 1: Install expo-image-picker and expo-secure-store**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart/apps/mobile
npx expo install expo-image-picker expo-secure-store
```

- [ ] **Step 2: Add shared package as dependency**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart
pnpm --filter @uchicago-marketplace/mobile add @uchicago-marketplace/shared@workspace:*
```

- [ ] **Step 3: Create color system**

Delete `apps/mobile/constants/Colors.ts` and create `apps/mobile/constants/colors.ts`:

```ts
export const colors = {
  // Brand accents per vertical
  marketplace: {
    primary: "#800000",
    light: "#fdf2f2",
    badge: "#800000",
  },
  storage: {
    primary: "#b45309",
    light: "#fef7e0",
    badge: "#b45309",
  },
  housing: {
    primary: "#6366f1",
    light: "#ede9fe",
    badge: "#6366f1",
  },

  // Shared palette
  maroon: {
    50: "#fdf2f2",
    100: "#f5d5d5",
    500: "#a00000",
    600: "#800000",
    700: "#660000",
  },
  gray: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
  },
  white: "#ffffff",
  black: "#000000",
  star: "#f5a623",
  success: "#2d6a2d",
  error: "#dc2626",

  // Badge colors
  badge: {
    condition: { bg: "#f0f7f0", text: "#2d6a2d" },
    category: { bg: "#f0f0f7", text: "#4a4a8a" },
    size: { bg: "#fef7e0", text: "#8a6d2a" },
    location: { bg: "#e0f0ff", text: "#2a5a8a" },
    amenity: { bg: "#fef3c7", text: "#92400e" },
    bedroom: { bg: "#ede9fe", text: "#5b21b6" },
  },
} as const;

export type PostTypeColor = keyof typeof colors & ("marketplace" | "storage" | "housing");

export function getAccentColor(type: string): string {
  if (type === "marketplace") return colors.marketplace.primary;
  if (type === "storage") return colors.storage.primary;
  if (type === "housing") return colors.housing.primary;
  return colors.maroon[600];
}
```

- [ ] **Step 4: Create typography constants**

Create `apps/mobile/constants/typography.ts`:

```ts
export const typography = {
  size: {
    xs: 10,
    sm: 11,
    base: 13,
    md: 14,
    lg: 15,
    xl: 18,
    "2xl": 20,
    "3xl": 22,
  },
  weight: {
    normal: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
} as const;
```

- [ ] **Step 5: Create auth context placeholder**

Create `apps/mobile/hooks/useAuth.ts`:

```ts
import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthState {
  accessToken: string | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  getToken: () => string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    user: null,
    isLoading: false,
  });

  const getToken = useCallback(() => state.accessToken, [state.accessToken]);

  const setToken = useCallback((token: string) => {
    setState((prev) => ({ ...prev, accessToken: token }));
  }, []);

  const logout = useCallback(() => {
    setState({ accessToken: null, user: null, isLoading: false });
  }, []);

  return React.createElement(
    AuthContext.Provider,
    { value: { ...state, getToken, setToken, logout } },
    children
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

- [ ] **Step 6: Create API client setup**

Create `apps/mobile/lib/api.ts`:

```ts
import { createApi } from "@uchicago-marketplace/shared";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

let tokenGetter: () => string | null = () => null;

export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

export const api = createApi(API_BASE_URL, () => tokenGetter());
```

- [ ] **Step 7: Update components that import old Colors path**

Update `apps/mobile/components/Themed.tsx` to import from new path:

Change `import Colors from '@/constants/Colors';` to:

```ts
import { colors } from '@/constants/colors';
```

Update `useThemeColor` to use the new color structure:

```ts
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: 'text' | 'background'
) {
  const colorFromProps = props.light; // simplified: light mode only for now
  if (colorFromProps) return colorFromProps;
  return colorName === 'text' ? colors.black : colors.white;
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/
git commit -m "feat: mobile foundation - colors, typography, auth context, API client"
```

---

## Task 8: Mobile Tab Navigation

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Rewrite: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/(tabs)/marketplace.tsx` (placeholder)
- Create: `apps/mobile/app/(tabs)/storage.tsx` (placeholder)
- Create: `apps/mobile/app/(tabs)/housing.tsx` (placeholder)
- Create: `apps/mobile/app/(tabs)/create.tsx` (placeholder)
- Create: `apps/mobile/app/(tabs)/profile.tsx` (placeholder)
- Delete: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/two.tsx`

- [ ] **Step 1: Update root layout to include AuthProvider and API wiring**

Rewrite `apps/mobile/app/_layout.tsx`:

```tsx
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { setTokenGetter } from "@/lib/api";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="posts/[id]"
          options={{ headerShown: false, presentation: "card" }}
        />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Create 5-tab layout with center FAB**

Rewrite `apps/mobile/app/(tabs)/_layout.tsx`:

```tsx
import React from "react";
import { Tabs } from "expo-router";
import { View, StyleSheet, Platform } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";

function TabIcon({ name, color }: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string }) {
  return <FontAwesome size={22} name={name} color={color} />;
}

function CreateTabIcon() {
  return (
    <View style={styles.fab}>
      <FontAwesome size={20} name="plus" color={colors.white} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.maroon[600],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="marketplace"
        options={{
          title: "Market",
          tabBarIcon: ({ color }) => <TabIcon name="shopping-bag" color={color} />,
        }}
      />
      <Tabs.Screen
        name="storage"
        options={{
          title: "Storage",
          tabBarIcon: ({ color }) => <TabIcon name="archive" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          tabBarIcon: () => <CreateTabIcon />,
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="housing"
        options={{
          title: "Housing",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <TabIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === "ios" ? 85 : 65,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.maroon[600],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: colors.maroon[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
```

- [ ] **Step 3: Create placeholder tab screens**

Create `apps/mobile/app/(tabs)/marketplace.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

export default function MarketplaceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Marketplace Feed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  text: { fontSize: 16, color: colors.gray[500] },
});
```

Create `apps/mobile/app/(tabs)/storage.tsx` (same pattern, text "Storage Feed").

Create `apps/mobile/app/(tabs)/housing.tsx` (same pattern, text "Housing Feed").

Create `apps/mobile/app/(tabs)/create.tsx` (same pattern, text "Create Post").

Create `apps/mobile/app/(tabs)/profile.tsx` (same pattern, text "Profile").

- [ ] **Step 4: Delete old tab files and unused components**

```bash
rm apps/mobile/app/(tabs)/index.tsx apps/mobile/app/(tabs)/two.tsx
rm apps/mobile/app/modal.tsx
rm apps/mobile/components/EditScreenInfo.tsx
rm apps/mobile/components/StyledText.tsx
```

- [ ] **Step 5: Create post detail placeholder**

Create directory and file `apps/mobile/app/posts/[id].tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { colors } from "@/constants/colors";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Post Detail: {id}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  text: { fontSize: 16, color: colors.gray[500] },
});
```

- [ ] **Step 6: Verify app runs**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart/apps/mobile
npx expo start --clear 2>&1 | head -20
```

Expected: Metro bundler starts. Verify on simulator/device that 5 tabs render.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/
git commit -m "feat: mobile 5-tab navigation with center FAB"
```

---

## Task 9: Reusable Components — PostCard, BadgeRow, AuthorRow

**Files:**
- Create: `apps/mobile/components/BadgeRow.tsx`
- Create: `apps/mobile/components/AuthorRow.tsx`
- Create: `apps/mobile/components/PostCard.tsx`

- [ ] **Step 1: Create BadgeRow component**

Create `apps/mobile/components/BadgeRow.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";

interface Badge {
  label: string;
  bg: string;
  text: string;
}

interface BadgeRowProps {
  badges: Badge[];
}

export function BadgeRow({ badges }: BadgeRowProps) {
  if (badges.length === 0) return null;
  return (
    <View style={styles.row}>
      {badges.map((badge, i) => (
        <View key={i} style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: "600" },
});
```

- [ ] **Step 2: Create AuthorRow component**

Create `apps/mobile/components/AuthorRow.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";
import { formatRelativeTime } from "@uchicago-marketplace/shared";

interface AuthorRowProps {
  name: string;
  rating?: number | null;
  createdAt: Date | string;
}

export function AuthorRow({ name, rating, createdAt }: AuthorRowProps) {
  const timeAgo = formatRelativeTime(new Date(createdAt));
  return (
    <View style={styles.row}>
      <Text style={styles.name}>{name}</Text>
      {rating != null && (
        <Text style={styles.star}>★ {rating.toFixed(1)}</Text>
      )}
      <Text style={styles.time}>{timeAgo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  name: { fontSize: 11, color: colors.gray[600] },
  star: { fontSize: 10, color: colors.star },
  time: { fontSize: 10, color: colors.gray[300], marginLeft: "auto" },
});
```

- [ ] **Step 3: Create PostCard component**

Create `apps/mobile/components/PostCard.tsx`:

```tsx
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import type { PostWithDetails } from "@uchicago-marketplace/shared";
import { formatPrice, formatDateRange } from "@uchicago-marketplace/shared";
import { colors, getAccentColor } from "@/constants/colors";
import { BadgeRow } from "./BadgeRow";
import { AuthorRow } from "./AuthorRow";

interface PostCardProps {
  post: PostWithDetails;
}

export function PostCard({ post }: PostCardProps) {
  const router = useRouter();
  const accent = getAccentColor(post.type);
  const thumbnail = post.images?.[0]?.url;

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(`/posts/${post.id}`)}
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={styles.placeholderIcon}>
            {post.type === "marketplace" ? "🏪" : post.type === "storage" ? "📦" : "🏠"}
          </Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{post.title}</Text>
        <Text style={[styles.price, { color: accent }]}>{formatPostPrice(post)}</Text>
        <BadgeRow badges={getBadges(post)} />
        {post.type === "storage" && post.storage && (
          <Text style={styles.dateRange}>
            {formatDateRange(new Date(post.storage.startDate), new Date(post.storage.endDate))}
          </Text>
        )}
        {post.type === "housing" && post.housing && (
          <Text style={styles.dateRange}>{getHousingDateLine(post.housing)}</Text>
        )}
        <AuthorRow name={post.author.name} createdAt={post.createdAt} />
      </View>
    </Pressable>
  );
}

function formatPostPrice(post: PostWithDetails): string {
  if (post.type === "marketplace" && post.marketplace) {
    return formatPrice(post.marketplace.priceAmount, post.marketplace.priceType);
  }
  if (post.type === "storage" && post.storage) {
    if (post.storage.isFree) return "Free";
    return post.storage.priceMonthly ? `$${post.storage.priceMonthly}/mo` : "Contact";
  }
  if (post.type === "housing" && post.housing) {
    return `$${post.housing.monthlyRent}/mo`;
  }
  return "";
}

function getBadges(post: PostWithDetails): Array<{ label: string; bg: string; text: string }> {
  const badges: Array<{ label: string; bg: string; text: string }> = [];
  if (post.type === "marketplace" && post.marketplace) {
    const c = post.marketplace.condition;
    const label = c === "new" ? "New" : c === "like_new" ? "Like New" : c === "good" ? "Good" : c === "fair" ? "Fair" : c === "for_parts" ? "For Parts" : "";
    if (label) badges.push({ label, ...colors.badge.condition });
    badges.push({ label: post.marketplace.category, ...colors.badge.category });
  }
  if (post.type === "storage" && post.storage) {
    const s = post.storage.size;
    const label = s === "boxes" ? "Boxes" : s === "half_room" ? "Half Room" : "Full Room";
    badges.push({ label, ...colors.badge.size });
    badges.push({
      label: post.storage.locationType === "on_campus" ? "On Campus" : "Off Campus",
      ...colors.badge.location,
    });
  }
  if (post.type === "housing" && post.housing) {
    const h = post.housing;
    const bed = h.bedrooms === "studio" ? "Studio" : h.bedrooms === "3_plus" ? "3+ Bed" : `${h.bedrooms} Bed`;
    const bath = h.bathrooms === "2_plus" ? "2+ Bath" : `${h.bathrooms} Bath`;
    badges.push({ label: `${bed} / ${bath}`, ...colors.badge.bedroom });
    h.amenities.slice(0, 2).forEach((a) => {
      const label = a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      badges.push({ label, ...colors.badge.amenity });
    });
  }
  return badges;
}

function getHousingDateLine(h: { subtype: string; moveInDate?: Date | null; moveOutDate?: Date | null; leaseStartDate?: Date | null; leaseDurationMonths?: number | null }): string {
  if (h.subtype === "sublet" && h.moveInDate && h.moveOutDate) {
    return formatDateRange(new Date(h.moveInDate), new Date(h.moveOutDate));
  }
  if (h.subtype === "passdown" && h.leaseStartDate && h.leaseDurationMonths) {
    const start = new Date(h.leaseStartDate);
    return `Lease starts ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${h.leaseDurationMonths} months`;
  }
  return "";
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    backgroundColor: colors.white,
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: 10,
    backgroundColor: colors.gray[100],
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIcon: { fontSize: 28 },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: "600", color: colors.gray[900] },
  price: { fontSize: 15, fontWeight: "700", marginVertical: 2 },
  dateRange: { fontSize: 10, color: colors.gray[500], marginTop: 3 },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/
git commit -m "feat: PostCard, BadgeRow, AuthorRow components"
```

---

## Task 10: State Components — Skeleton, Empty, Error

**Files:**
- Create: `apps/mobile/components/PostCardSkeleton.tsx`
- Create: `apps/mobile/components/EmptyState.tsx`
- Create: `apps/mobile/components/ErrorState.tsx`

- [ ] **Step 1: Create PostCardSkeleton**

Create `apps/mobile/components/PostCardSkeleton.tsx`:

```tsx
import { View, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { colors } from "@/constants/colors";

function PulseBox({ style }: { style: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.View style={[style, { opacity, backgroundColor: colors.gray[200] }]} />;
}

export function PostCardSkeleton() {
  return (
    <View style={styles.card}>
      <PulseBox style={styles.image} />
      <View style={styles.info}>
        <PulseBox style={styles.titleBar} />
        <PulseBox style={styles.priceBar} />
        <PulseBox style={styles.badgeBar} />
        <PulseBox style={styles.authorBar} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  image: { width: 88, height: 88, borderRadius: 10 },
  info: { flex: 1, gap: 6 },
  titleBar: { height: 12, borderRadius: 4, width: "80%" },
  priceBar: { height: 14, borderRadius: 4, width: "40%" },
  badgeBar: { height: 10, borderRadius: 4, width: "60%" },
  authorBar: { height: 10, borderRadius: 4, width: "50%", marginTop: 4 },
});
```

- [ ] **Step 2: Create EmptyState**

Create `apps/mobile/components/EmptyState.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/constants/colors";

interface EmptyStateProps {
  icon: string;
  message: string;
  showCreateButton?: boolean;
}

export function EmptyState({ icon, message, showCreateButton = true }: EmptyStateProps) {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
      {showCreateButton && (
        <Pressable style={styles.button} onPress={() => router.push("/(tabs)/create")}>
          <Text style={styles.buttonText}>Create a Post</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { fontSize: 48, marginBottom: 12 },
  message: { fontSize: 14, color: colors.gray[500], textAlign: "center", lineHeight: 20 },
  button: {
    marginTop: 16,
    backgroundColor: colors.maroon[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
});
```

- [ ] **Step 3: Create ErrorState**

Create `apps/mobile/components/ErrorState.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>😵</Text>
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.hint}>Campus WiFi strikes again...</Text>
      <Pressable style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  icon: { fontSize: 48, marginBottom: 12 },
  message: { fontSize: 15, fontWeight: "600", color: colors.gray[800] },
  hint: { fontSize: 12, color: colors.gray[400], marginTop: 4 },
  button: {
    marginTop: 16,
    borderWidth: 2,
    borderColor: colors.maroon[600],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: colors.maroon[600], fontWeight: "700", fontSize: 14 },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/
git commit -m "feat: PostCardSkeleton, EmptyState, ErrorState components"
```

---

## Task 11: Feed UI Components — SearchBar, FilterChips, SortPicker, SegmentedControl

**Files:**
- Create: `apps/mobile/components/SearchBar.tsx`
- Create: `apps/mobile/components/FilterChips.tsx`
- Create: `apps/mobile/components/SortPicker.tsx`
- Create: `apps/mobile/components/SegmentedControl.tsx`

- [ ] **Step 1: Create SearchBar**

Create `apps/mobile/components/SearchBar.tsx`:

```tsx
import { View, TextInput, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, onSubmit, placeholder = "Search..." }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <FontAwesome name="search" size={14} color={colors.gray[400]} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        returnKeyType="search"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.gray[50],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  input: { flex: 1, fontSize: 13, color: colors.gray[800], padding: 0 },
});
```

- [ ] **Step 2: Create FilterChips**

Create `apps/mobile/components/FilterChips.tsx`:

```tsx
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface Chip {
  label: string;
  value: string;
}

interface FilterChipsProps {
  chips: Chip[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export function FilterChips({ chips, selected, onSelect, accentColor = colors.maroon[600] }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {chips.map((chip) => {
        const active = chip.value === selected;
        return (
          <Pressable
            key={chip.value}
            style={[styles.chip, active && { backgroundColor: accentColor }]}
            onPress={() => onSelect(chip.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.gray[100],
  },
  chipText: { fontSize: 11, color: colors.gray[600], fontWeight: "500" },
  chipTextActive: { color: colors.white },
});
```

- [ ] **Step 3: Create SortPicker**

Create `apps/mobile/components/SortPicker.tsx`:

```tsx
import { View, Text, Pressable, Modal, StyleSheet, FlatList } from "react-native";
import { useState } from "react";
import { colors } from "@/constants/colors";

interface SortOption {
  label: string;
  value: string;
}

interface SortPickerProps {
  options: SortOption[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor?: string;
}

export function SortPicker({ options, selected, onSelect, accentColor = colors.maroon[600] }: SortPickerProps) {
  const [visible, setVisible] = useState(false);
  const selectedLabel = options.find((o) => o.value === selected)?.label ?? "Sort";

  return (
    <>
      <Pressable onPress={() => setVisible(true)}>
        <Text style={[styles.trigger, { color: accentColor }]}>Sort: {selectedLabel} ▾</Text>
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Sort by</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => { onSelect(item.value); setVisible(false); }}
                >
                  <Text style={[styles.optionText, item.value === selected && { color: accentColor, fontWeight: "700" }]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { fontSize: 11, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  sheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, color: colors.gray[900] },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  optionText: { fontSize: 14, color: colors.gray[700] },
});
```

- [ ] **Step 4: Create SegmentedControl**

Create `apps/mobile/components/SegmentedControl.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface Segment {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  selected: string;
  onSelect: (value: string) => void;
}

export function SegmentedControl({ segments, selected, onSelect }: SegmentedControlProps) {
  return (
    <View style={styles.container}>
      {segments.map((seg) => {
        const active = seg.value === selected;
        return (
          <Pressable
            key={seg.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(seg.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{seg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.gray[100],
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginTop: 10,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  label: { fontSize: 13, color: colors.gray[400] },
  labelActive: { fontWeight: "600", color: colors.gray[900] },
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/
git commit -m "feat: SearchBar, FilterChips, SortPicker, SegmentedControl components"
```

---

## Task 12: Feed Hook — usePostsFeed

**Files:**
- Create: `apps/mobile/hooks/usePostsFeed.ts`
- Create: `apps/mobile/hooks/usePostDetail.ts`

- [ ] **Step 1: Create usePostsFeed hook**

Create `apps/mobile/hooks/usePostsFeed.ts`:

```ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { PostWithDetails, PostQueryInput } from "@uchicago-marketplace/shared";
import { api } from "@/lib/api";

interface FeedState {
  posts: PostWithDetails[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
}

interface UseFeedOptions {
  type?: PostQueryInput["type"];
  initialFilters?: Partial<PostQueryInput>;
}

export function usePostsFeed({ type, initialFilters = {} }: UseFeedOptions) {
  const [state, setState] = useState<FeedState>({
    posts: [],
    isLoading: true,
    isRefreshing: false,
    isLoadingMore: false,
    error: null,
    hasMore: true,
    total: 0,
  });
  const [filters, setFilters] = useState<Partial<PostQueryInput>>({
    ...initialFilters,
    type,
    sort: "recent",
  });
  const pageRef = useRef(1);

  const fetchPosts = useCallback(async (page: number, append: boolean) => {
    try {
      const result = await api.posts.list({ ...filters, page, limit: 20 });
      const posts = result.data ?? (result as any).posts ?? [];
      const total = result.total ?? (result as any).pagination?.total ?? 0;
      const totalPages = Math.ceil(total / 20);
      setState((prev) => ({
        ...prev,
        posts: append ? [...prev.posts, ...posts] : posts,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        error: null,
        hasMore: page < totalPages,
        total,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        isLoadingMore: false,
        error: err instanceof Error ? err.message : "Failed to load posts",
      }));
    }
  }, [filters]);

  // Initial load and filter changes
  useEffect(() => {
    pageRef.current = 1;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    fetchPosts(1, false);
  }, [fetchPosts]);

  const refresh = useCallback(() => {
    pageRef.current = 1;
    setState((prev) => ({ ...prev, isRefreshing: true }));
    fetchPosts(1, false);
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (state.isLoadingMore || !state.hasMore) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    setState((prev) => ({ ...prev, isLoadingMore: true }));
    fetchPosts(nextPage, true);
  }, [state.isLoadingMore, state.hasMore, fetchPosts]);

  const updateFilters = useCallback((newFilters: Partial<PostQueryInput>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  return { ...state, refresh, loadMore, filters, updateFilters };
}
```

- [ ] **Step 2: Create usePostDetail hook**

Create `apps/mobile/hooks/usePostDetail.ts`:

```ts
import { useState, useEffect, useCallback } from "react";
import type { PostWithDetails } from "@uchicago-marketplace/shared";
import { api } from "@/lib/api";

interface DetailState {
  post: PostWithDetails | null;
  isLoading: boolean;
  error: string | null;
}

export function usePostDetail(postId: string) {
  const [state, setState] = useState<DetailState>({
    post: null,
    isLoading: true,
    error: null,
  });

  const fetchPost = useCallback(async () => {
    setState({ post: null, isLoading: true, error: null });
    try {
      const post = await api.posts.get(postId);
      setState({ post, isLoading: false, error: null });
    } catch (err) {
      setState({
        post: null,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to load post",
      });
    }
  }, [postId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  return { ...state, refetch: fetchPost };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/hooks/
git commit -m "feat: usePostsFeed and usePostDetail hooks"
```

---

## Task 13: Marketplace Feed Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/marketplace.tsx`

- [ ] **Step 1: Implement marketplace feed**

Rewrite `apps/mobile/app/(tabs)/marketplace.tsx`:

```tsx
import { View, FlatList, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MARKETPLACE_CATEGORIES } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";
import { usePostsFeed } from "@/hooks/usePostsFeed";
import { PostCard } from "@/components/PostCard";
import { SkeletonList } from "@/components/PostCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { SortPicker } from "@/components/SortPicker";
import { useState } from "react";

const CATEGORY_CHIPS = [
  { label: "All", value: "" },
  ...MARKETPLACE_CATEGORIES.map((c) => ({ label: c.split(" ")[0], value: c })),
];

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const feed = usePostsFeed({ type: "marketplace" });

  const handleSearch = () => {
    feed.updateFilters({ q: searchText || undefined });
  };

  const handleCategorySelect = (value: string) => {
    feed.updateFilters({ category: value || undefined });
  };

  const header = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Marketplace</Text>
      </View>
      <SearchBar
        value={searchText}
        onChangeText={setSearchText}
        onSubmit={handleSearch}
        placeholder="Search items..."
      />
      <FilterChips
        chips={CATEGORY_CHIPS}
        selected={feed.filters.category ?? ""}
        onSelect={handleCategorySelect}
        accentColor={colors.marketplace.primary}
      />
      <View style={styles.meta}>
        <Text style={styles.count}>{feed.total} items</Text>
        <SortPicker
          options={SORT_OPTIONS}
          selected={feed.filters.sort ?? "recent"}
          onSelect={(sort) => feed.updateFilters({ sort: sort as any })}
          accentColor={colors.marketplace.primary}
        />
      </View>
    </View>
  );

  if (feed.isLoading) {
    return (
      <View style={styles.container}>
        {header}
        <SkeletonList />
      </View>
    );
  }

  if (feed.error) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState onRetry={feed.refresh} />
      </View>
    );
  }

  if (feed.posts.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState icon="🏪" message={"Nothing for sale yet —\nbe the first Maroon to list!"} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feed.posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        onRefresh={feed.refresh}
        refreshing={feed.isRefreshing}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.gray[900] },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  count: { fontSize: 11, color: colors.gray[400] },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/marketplace.tsx
git commit -m "feat: marketplace feed screen with search, filters, infinite scroll"
```

---

## Task 14: Storage Feed Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/storage.tsx`

- [ ] **Step 1: Implement storage feed**

Rewrite `apps/mobile/app/(tabs)/storage.tsx`. Same structure as marketplace but with storage-specific filters:

```tsx
import { View, FlatList, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { usePostsFeed } from "@/hooks/usePostsFeed";
import { PostCard } from "@/components/PostCard";
import { SkeletonList } from "@/components/PostCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { SortPicker } from "@/components/SortPicker";
import { useState } from "react";

const SIDE_CHIPS = [
  { label: "All", value: "" },
  { label: "Has Space", value: "has_space" },
  { label: "Need Storage", value: "need_storage" },
];

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

export default function StorageScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const feed = usePostsFeed({ type: "storage" });

  const handleSearch = () => {
    feed.updateFilters({ q: searchText || undefined });
  };

  const handleSideSelect = (value: string) => {
    feed.updateFilters({ side: (value || undefined) as any });
  };

  const header = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Storage</Text>
      </View>
      <SearchBar value={searchText} onChangeText={setSearchText} onSubmit={handleSearch} placeholder="Search storage..." />
      <FilterChips chips={SIDE_CHIPS} selected={(feed.filters.side as string) ?? ""} onSelect={handleSideSelect} accentColor={colors.storage.primary} />
      <View style={styles.meta}>
        <Text style={styles.count}>{feed.total} posts</Text>
        <SortPicker options={SORT_OPTIONS} selected={feed.filters.sort ?? "recent"} onSelect={(sort) => feed.updateFilters({ sort: sort as any })} accentColor={colors.storage.primary} />
      </View>
    </View>
  );

  if (feed.isLoading) return <View style={styles.container}>{header}<SkeletonList /></View>;
  if (feed.error) return <View style={styles.container}>{header}<ErrorState onRetry={feed.refresh} /></View>;
  if (feed.posts.length === 0) return <View style={styles.container}>{header}<EmptyState icon="📦" message={"No storage posts yet —\ngot space to share?"} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={feed.posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        onRefresh={feed.refresh}
        refreshing={feed.isRefreshing}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.gray[900] },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  count: { fontSize: 11, color: colors.gray[400] },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/storage.tsx
git commit -m "feat: storage feed screen with side filters"
```

---

## Task 15: Housing Feed Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/housing.tsx`

- [ ] **Step 1: Implement housing feed with segmented control**

Rewrite `apps/mobile/app/(tabs)/housing.tsx`:

```tsx
import { View, FlatList, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/colors";
import { usePostsFeed } from "@/hooks/usePostsFeed";
import { PostCard } from "@/components/PostCard";
import { SkeletonList } from "@/components/PostCardSkeleton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SearchBar } from "@/components/SearchBar";
import { FilterChips } from "@/components/FilterChips";
import { SegmentedControl } from "@/components/SegmentedControl";
import { SortPicker } from "@/components/SortPicker";
import { useState } from "react";

const SEGMENTS = [
  { label: "Sublets", value: "sublet" },
  { label: "Passdowns", value: "passdown" },
];

const SIDE_CHIPS = [
  { label: "All", value: "" },
  { label: "Offering", value: "offering" },
  { label: "Looking", value: "looking" },
];

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

export default function HousingScreen() {
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState("");
  const [subtype, setSubtype] = useState("sublet");
  const feed = usePostsFeed({
    type: "housing",
    initialFilters: { subtype: "sublet" as any },
  });

  const handleSubtypeChange = (value: string) => {
    setSubtype(value);
    feed.updateFilters({ subtype: value as any });
  };

  const handleSearch = () => {
    feed.updateFilters({ q: searchText || undefined });
  };

  const handleSideSelect = (value: string) => {
    feed.updateFilters({ side: (value || undefined) as any });
  };

  const header = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Housing</Text>
      </View>
      <SegmentedControl segments={SEGMENTS} selected={subtype} onSelect={handleSubtypeChange} />
      <SearchBar value={searchText} onChangeText={setSearchText} onSubmit={handleSearch} placeholder="Search housing..." />
      <FilterChips chips={SIDE_CHIPS} selected={(feed.filters.side as string) ?? ""} onSelect={handleSideSelect} accentColor={colors.housing.primary} />
      <View style={styles.meta}>
        <Text style={styles.count}>{feed.total} posts</Text>
        <SortPicker options={SORT_OPTIONS} selected={feed.filters.sort ?? "recent"} onSelect={(sort) => feed.updateFilters({ sort: sort as any })} accentColor={colors.housing.primary} />
      </View>
    </View>
  );

  if (feed.isLoading) return <View style={styles.container}>{header}<SkeletonList /></View>;
  if (feed.error) return <View style={styles.container}>{header}<ErrorState onRetry={feed.refresh} /></View>;
  if (feed.posts.length === 0) return <View style={styles.container}>{header}<EmptyState icon="🏠" message={"No housing posts yet —\nhelp a fellow Maroon find a home!"} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={feed.posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ListHeaderComponent={header}
        onRefresh={feed.refresh}
        refreshing={feed.isRefreshing}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.gray[900] },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  count: { fontSize: 11, color: colors.gray[400] },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/housing.tsx
git commit -m "feat: housing feed screen with segmented control for sublets/passdowns"
```

---

## Task 16: Post Detail Screen

**Files:**
- Create: `apps/mobile/components/ImageCarousel.tsx`
- Rewrite: `apps/mobile/app/posts/[id].tsx`

- [ ] **Step 1: Create ImageCarousel component**

Create `apps/mobile/components/ImageCarousel.tsx`:

```tsx
import { View, Image, FlatList, Dimensions, StyleSheet } from "react-native";
import { useState } from "react";
import { colors } from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ImageCarouselProps {
  images: Array<{ id: string; url: string }>;
  fallbackIcon?: string;
}

export function ImageCarousel({ images, fallbackIcon = "📷" }: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <View style={[styles.image, styles.placeholder]}>
        <View style={styles.fallback}>
          <View style={styles.fallbackInner}>
            <Image
              source={{ uri: "" }}
              style={{ width: 0, height: 0 }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveIndex(index);
        }}
        renderItem={({ item }) => (
          <Image source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
        )}
      />
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { width: SCREEN_WIDTH, aspectRatio: 4 / 3, backgroundColor: colors.gray[100] },
  placeholder: { alignItems: "center", justifyContent: "center" },
  fallback: { fontSize: 56 },
  fallbackInner: { alignItems: "center", justifyContent: "center" },
  dots: {
    flexDirection: "row",
    gap: 4,
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: colors.white },
});
```

- [ ] **Step 2: Implement post detail screen**

Rewrite `apps/mobile/app/posts/[id].tsx`:

```tsx
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { formatDateRange } from "@uchicago-marketplace/shared";
import { colors, getAccentColor } from "@/constants/colors";
import { usePostDetail } from "@/hooks/usePostDetail";
import { ImageCarousel } from "@/components/ImageCarousel";
import { BadgeRow } from "@/components/BadgeRow";
import { ErrorState } from "@/components/ErrorState";
import type { PostWithDetails } from "@uchicago-marketplace/shared";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { post, isLoading, error, refetch } = usePostDetail(id!);

  if (isLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.maroon[600]} />
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <NavBar onBack={() => router.back()} />
        <ErrorState message={error ?? "Post not found"} onRetry={refetch} />
      </View>
    );
  }

  const accent = getAccentColor(post.type);

  return (
    <View style={styles.container}>
      <ScrollView>
        <View style={{ paddingTop: insets.top }}>
          <NavBar onBack={() => router.back()} />
        </View>
        <ImageCarousel images={post.images ?? []} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{post.title}</Text>
            <Pressable style={styles.saveBtn} disabled>
              <FontAwesome name="heart-o" size={18} color={colors.gray[300]} />
            </Pressable>
          </View>
          <Text style={[styles.price, { color: accent }]}>{formatDetailPrice(post)}</Text>
          <View style={{ marginTop: 8 }}>
            <BadgeRow badges={getDetailBadges(post)} />
          </View>
          {post.type === "housing" && post.housing && (
            <HousingInfoGrid housing={post.housing} />
          )}
          {post.description && (
            <Text style={styles.description}>{post.description}</Text>
          )}
          <AuthorCard post={post} />
          <View style={styles.ctas}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: accent }]} disabled>
              <Text style={styles.primaryBtnText}>Message</Text>
            </Pressable>
            <Pressable style={[styles.secondaryBtn, { borderColor: accent }]} disabled>
              <Text style={[styles.secondaryBtnText, { color: accent }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function NavBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.navBar}>
      <Pressable onPress={onBack} hitSlop={8}>
        <FontAwesome name="arrow-left" size={18} color={colors.maroon[600]} />
      </Pressable>
      <Text style={styles.navTitle}>Post Detail</Text>
      <View style={{ width: 18 }} />
    </View>
  );
}

function HousingInfoGrid({ housing }: { housing: NonNullable<PostWithDetails["housing"]> }) {
  const items: Array<{ label: string; value: string }> = [];
  if (housing.subtype === "sublet") {
    if (housing.moveInDate) items.push({ label: "Move in", value: new Date(housing.moveInDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
    if (housing.moveOutDate) items.push({ label: "Move out", value: new Date(housing.moveOutDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  } else {
    if (housing.leaseStartDate) items.push({ label: "Lease starts", value: new Date(housing.leaseStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
    if (housing.leaseDurationMonths) items.push({ label: "Duration", value: `${housing.leaseDurationMonths} months` });
  }
  const roommates = housing.roommates === "solo" ? "Solo" : `Shared (${housing.roommateCount ?? "?"})`;
  items.push({ label: "Roommates", value: roommates });
  if (housing.neighborhood) items.push({ label: "Location", value: housing.neighborhood });

  return (
    <View style={styles.infoGrid}>
      {items.map((item, i) => (
        <View key={i} style={styles.infoCell}>
          <Text style={styles.infoLabel}>{item.label}</Text>
          <Text style={styles.infoValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function AuthorCard({ post }: { post: PostWithDetails }) {
  const initials = post.author.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const accent = getAccentColor(post.type);
  return (
    <View style={styles.authorCard}>
      <View style={[styles.avatar, { backgroundColor: accent }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View>
        <Text style={styles.authorName}>{post.author.name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {post.author.isVerified && <Text style={styles.verified}>Verified</Text>}
        </View>
      </View>
    </View>
  );
}

function formatDetailPrice(post: PostWithDetails): string {
  if (post.type === "marketplace" && post.marketplace) {
    if (post.marketplace.priceType === "free") return "Free";
    if (post.marketplace.priceType === "trade") return "Trade";
    return post.marketplace.priceAmount != null ? `$${post.marketplace.priceAmount}` : "";
  }
  if (post.type === "storage" && post.storage) {
    if (post.storage.isFree) return "Free";
    return post.storage.priceMonthly ? `$${post.storage.priceMonthly}/mo` : "Contact";
  }
  if (post.type === "housing" && post.housing) {
    return `$${post.housing.monthlyRent}/mo`;
  }
  return "";
}

function getDetailBadges(post: PostWithDetails) {
  // Reuse same logic as PostCard — import would be cleaner but inlining for self-containment
  const badges: Array<{ label: string; bg: string; text: string }> = [];
  if (post.type === "marketplace" && post.marketplace) {
    const c = post.marketplace.condition;
    const label = c === "new" ? "New" : c === "like_new" ? "Like New" : c === "good" ? "Good" : c === "fair" ? "Fair" : c === "for_parts" ? "For Parts" : "";
    if (label) badges.push({ label, ...colors.badge.condition });
    badges.push({ label: post.marketplace.category, ...colors.badge.category });
    badges.push({ label: post.side === "sell" ? "Selling" : "Buying", bg: colors.maroon[600], text: colors.white });
  }
  if (post.type === "storage" && post.storage) {
    const s = post.storage.size;
    const label = s === "boxes" ? "Boxes" : s === "half_room" ? "Half Room" : "Full Room";
    badges.push({ label, ...colors.badge.size });
    badges.push({ label: post.storage.locationType === "on_campus" ? "On Campus" : "Off Campus", ...colors.badge.location });
  }
  if (post.type === "housing" && post.housing) {
    const h = post.housing;
    const bed = h.bedrooms === "studio" ? "Studio" : h.bedrooms === "3_plus" ? "3+ Bed" : `${h.bedrooms} Bed`;
    const bath = h.bathrooms === "2_plus" ? "2+ Bath" : `${h.bathrooms} Bath`;
    badges.push({ label: `${bed} / ${bath}`, ...colors.badge.bedroom });
    h.amenities.forEach((a) => {
      badges.push({ label: a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), ...colors.badge.amenity });
    });
    badges.push({ label: h.subtype === "sublet" ? "Sublet" : "Passdown", bg: colors.housing.primary, text: colors.white });
  }
  return badges;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  navTitle: { fontSize: 14, fontWeight: "600", color: colors.gray[900] },
  content: { padding: 16 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 18, fontWeight: "700", color: colors.gray[900], flex: 1, marginRight: 8 },
  saveBtn: { padding: 4 },
  price: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  description: { fontSize: 13, color: colors.gray[600], lineHeight: 20, marginTop: 12 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: colors.gray[50], borderRadius: 8, padding: 10, marginTop: 10, gap: 6 },
  infoCell: { width: "48%" },
  infoLabel: { fontSize: 9, color: colors.gray[400], textTransform: "uppercase" },
  infoValue: { fontSize: 12, fontWeight: "600", color: colors.gray[800] },
  authorCard: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: "600" },
  authorName: { fontSize: 13, fontWeight: "600", color: colors.gray[800] },
  verified: { fontSize: 10, color: colors.success },
  ctas: { flexDirection: "row", gap: 8, marginTop: 16 },
  primaryBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", opacity: 0.5 },
  primaryBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  secondaryBtn: { borderWidth: 2, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", opacity: 0.5 },
  secondaryBtnText: { fontWeight: "600", fontSize: 14 },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/ImageCarousel.tsx apps/mobile/app/posts/
git commit -m "feat: post detail screen with image carousel and type-specific layouts"
```

---

## Task 17: Create Post Wizard — Steps 1-2

**Files:**
- Create: `apps/mobile/components/StepIndicator.tsx`
- Create: `apps/mobile/components/ImagePickerGrid.tsx`
- Create: `apps/mobile/components/TypeSelector.tsx`
- Create: `apps/mobile/hooks/useCreatePost.ts`
- Begin: `apps/mobile/app/(tabs)/create.tsx`

- [ ] **Step 1: Create StepIndicator**

Create `apps/mobile/components/StepIndicator.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepPress: (step: number) => void;
}

export function StepIndicator({ steps, currentStep, onStepPress }: StepIndicatorProps) {
  return (
    <View style={styles.container}>
      {steps.map((label, i) => {
        const step = i + 1;
        const isComplete = step < currentStep;
        const isCurrent = step === currentStep;
        const canNavigate = step < currentStep;
        return (
          <Pressable
            key={i}
            style={styles.step}
            onPress={() => canNavigate && onStepPress(step)}
            disabled={!canNavigate}
          >
            <View style={[styles.circle, isCurrent && styles.circleCurrent, isComplete && styles.circleComplete]}>
              {isComplete ? (
                <FontAwesome name="check" size={10} color={colors.white} />
              ) : (
                <Text style={[styles.circleText, isCurrent && styles.circleTextCurrent]}>{step}</Text>
              )}
            </View>
            <Text style={[styles.label, isCurrent && styles.labelCurrent]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  step: { alignItems: "center", flex: 1 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.gray[200], alignItems: "center", justifyContent: "center" },
  circleCurrent: { backgroundColor: colors.maroon[600] },
  circleComplete: { backgroundColor: colors.success },
  circleText: { fontSize: 11, fontWeight: "700", color: colors.gray[500] },
  circleTextCurrent: { color: colors.white },
  label: { fontSize: 9, color: colors.gray[400], marginTop: 4, textAlign: "center" },
  labelCurrent: { color: colors.maroon[600], fontWeight: "600" },
});
```

- [ ] **Step 2: Create ImagePickerGrid**

Create `apps/mobile/components/ImagePickerGrid.tsx`:

```tsx
import { View, Image, Pressable, Text, StyleSheet, Alert } from "react-native";
import * as ExpoImagePicker from "expo-image-picker";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { APP_CONFIG } from "@uchicago-marketplace/shared";
import { colors } from "@/constants/colors";

interface ImagePickerGridProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
}

export function ImagePickerGrid({ images, onImagesChange }: ImagePickerGridProps) {
  const maxImages = APP_CONFIG.maxImagesPerPost;

  const pickImages = async () => {
    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      Alert.alert("Limit reached", `Maximum ${maxImages} photos allowed.`);
      return;
    }
    const result = await ExpoImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      onImagesChange([...images, ...uris]);
    }
  };

  const takePhoto = async () => {
    if (images.length >= maxImages) {
      Alert.alert("Limit reached", `Maximum ${maxImages} photos allowed.`);
      return;
    }
    const perm = await ExpoImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera access is required to take photos.");
      return;
    }
    const result = await ExpoImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      onImagesChange([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  return (
    <View>
      <View style={styles.grid}>
        {images.map((uri, i) => (
          <View key={i} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.image} />
            <Pressable style={styles.removeBtn} onPress={() => removeImage(i)}>
              <FontAwesome name="times-circle" size={20} color={colors.error} />
            </Pressable>
          </View>
        ))}
        {images.length < maxImages && (
          <View style={styles.addButtons}>
            <Pressable style={styles.addBtn} onPress={pickImages}>
              <FontAwesome name="photo" size={24} color={colors.gray[400]} />
              <Text style={styles.addText}>Library</Text>
            </Pressable>
            <Pressable style={styles.addBtn} onPress={takePhoto}>
              <FontAwesome name="camera" size={24} color={colors.gray[400]} />
              <Text style={styles.addText}>Camera</Text>
            </Pressable>
          </View>
        )}
      </View>
      <Text style={styles.counter}>{images.length}/{maxImages} photos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
  imageWrapper: { width: 88, height: 88, borderRadius: 10, overflow: "hidden" },
  image: { width: "100%", height: "100%", borderRadius: 10 },
  removeBtn: { position: "absolute", top: 2, right: 2, backgroundColor: colors.white, borderRadius: 10 },
  addButtons: { flexDirection: "row", gap: 8 },
  addBtn: {
    width: 88, height: 88, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: colors.gray[300], alignItems: "center", justifyContent: "center", gap: 4,
  },
  addText: { fontSize: 10, color: colors.gray[400] },
  counter: { fontSize: 11, color: colors.gray[400], textAlign: "center", marginTop: 4 },
});
```

- [ ] **Step 3: Create TypeSelector**

Create `apps/mobile/components/TypeSelector.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "@/constants/colors";

interface TypeOption {
  type: string;
  icon: string;
  label: string;
  description: string;
  color: string;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: "marketplace", icon: "🏪", label: "Marketplace", description: "Buy or sell items", color: colors.marketplace.primary },
  { type: "storage", icon: "📦", label: "Storage", description: "Find or offer space", color: colors.storage.primary },
  { type: "housing", icon: "🏠", label: "Housing", description: "Sublets & passdowns", color: colors.housing.primary },
];

interface TypeSelectorProps {
  selectedType: string | null;
  onSelectType: (type: string) => void;
  selectedSubtype?: string | null;
  onSelectSubtype?: (subtype: string) => void;
}

export function TypeSelector({ selectedType, onSelectType, selectedSubtype, onSelectSubtype }: TypeSelectorProps) {
  return (
    <View style={styles.container}>
      {TYPE_OPTIONS.map((opt) => {
        const active = selectedType === opt.type;
        return (
          <Pressable
            key={opt.type}
            style={[styles.tile, active && { borderColor: opt.color, backgroundColor: `${opt.color}08` }]}
            onPress={() => onSelectType(opt.type)}
          >
            <Text style={styles.icon}>{opt.icon}</Text>
            <View>
              <Text style={[styles.label, active && { color: opt.color }]}>{opt.label}</Text>
              <Text style={styles.description}>{opt.description}</Text>
            </View>
          </Pressable>
        );
      })}
      {selectedType === "housing" && onSelectSubtype && (
        <View style={styles.subtypeRow}>
          <Pressable
            style={[styles.subtypeBtn, selectedSubtype === "sublet" && styles.subtypeBtnActive]}
            onPress={() => onSelectSubtype("sublet")}
          >
            <Text style={[styles.subtypeText, selectedSubtype === "sublet" && styles.subtypeTextActive]}>Sublet</Text>
          </Pressable>
          <Pressable
            style={[styles.subtypeBtn, selectedSubtype === "passdown" && styles.subtypeBtnActive]}
            onPress={() => onSelectSubtype("passdown")}
          >
            <Text style={[styles.subtypeText, selectedSubtype === "passdown" && styles.subtypeTextActive]}>Passdown</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  tile: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, borderWidth: 2, borderColor: colors.gray[200] },
  icon: { fontSize: 28 },
  label: { fontSize: 15, fontWeight: "600", color: colors.gray[800] },
  description: { fontSize: 12, color: colors.gray[500], marginTop: 2 },
  subtypeRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  subtypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: colors.gray[200], alignItems: "center" },
  subtypeBtnActive: { borderColor: colors.housing.primary, backgroundColor: colors.housing.light },
  subtypeText: { fontSize: 13, fontWeight: "600", color: colors.gray[500] },
  subtypeTextActive: { color: colors.housing.primary },
});
```

- [ ] **Step 4: Create useCreatePost hook**

Create `apps/mobile/hooks/useCreatePost.ts`:

```ts
import { useState, useCallback } from "react";
import type { CreatePostInput } from "@uchicago-marketplace/shared";
import { api } from "@/lib/api";

interface WizardState {
  step: number;
  images: string[];
  type: "marketplace" | "storage" | "housing" | null;
  housingSubtype: "sublet" | "passdown" | null;
  title: string;
  description: string;
  // Marketplace fields
  side: string;
  category: string;
  condition: string;
  priceType: "fixed" | "free" | "trade";
  priceAmount: string;
  tradeDescription: string;
  tags: string;
  // Storage fields
  startDate: string;
  endDate: string;
  size: string;
  locationType: string;
  neighborhood: string;
  isFree: boolean;
  priceMonthly: string;
  restrictions: string;
  // Housing fields
  monthlyRent: string;
  bedrooms: string;
  bathrooms: string;
  amenities: string[];
  roommates: string;
  roommateCount: string;
  moveInDate: string;
  moveOutDate: string;
  leaseStartDate: string;
  leaseDurationMonths: string;
  // Submission
  isSubmitting: boolean;
  error: string | null;
}

const INITIAL_STATE: WizardState = {
  step: 1, images: [], type: null, housingSubtype: null,
  title: "", description: "",
  side: "", category: "", condition: "", priceType: "fixed", priceAmount: "", tradeDescription: "", tags: "",
  startDate: "", endDate: "", size: "", locationType: "", neighborhood: "", isFree: false, priceMonthly: "", restrictions: "",
  monthlyRent: "", bedrooms: "", bathrooms: "", amenities: [], roommates: "", roommateCount: "",
  moveInDate: "", moveOutDate: "", leaseStartDate: "", leaseDurationMonths: "",
  isSubmitting: false, error: null,
};

export function useCreatePost() {
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  const update = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const canAdvance = useCallback((): boolean => {
    switch (state.step) {
      case 1: return true; // photos optional
      case 2: return state.type !== null && (state.type !== "housing" || state.housingSubtype !== null);
      case 3: return state.title.trim().length >= 1 && state.title.trim().length <= 80;
      case 4: return validateStep4(state);
      default: return false;
    }
  }, [state]);

  const nextStep = useCallback(() => {
    if (canAdvance() && state.step < 5) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    }
  }, [canAdvance, state.step]);

  const prevStep = useCallback(() => {
    if (state.step > 1) setState((prev) => ({ ...prev, step: prev.step - 1 }));
  }, [state.step]);

  const buildPayload = useCallback((): CreatePostInput => {
    if (state.type === "marketplace") {
      return {
        type: "marketplace",
        side: state.side as "sell" | "buy",
        title: state.title.trim(),
        description: state.description.trim() || null,
        marketplace: {
          priceType: state.priceType,
          priceAmount: state.priceType === "fixed" ? parseFloat(state.priceAmount) : null,
          condition: state.condition as any,
          category: state.category,
          tradeDescription: state.priceType === "trade" ? state.tradeDescription : null,
          tags: state.tags ? state.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        },
      };
    }
    if (state.type === "storage") {
      return {
        type: "storage",
        side: state.side as "has_space" | "need_storage",
        title: state.title.trim(),
        description: state.description.trim() || null,
        storage: {
          startDate: state.startDate,
          endDate: state.endDate,
          size: state.size as any,
          locationType: state.locationType as any,
          neighborhood: state.neighborhood || null,
          priceMonthly: state.isFree ? null : parseFloat(state.priceMonthly) || null,
          isFree: state.isFree,
          restrictions: state.restrictions || null,
        },
      };
    }
    // housing
    return {
      type: "housing",
      side: state.side as "offering" | "looking",
      title: state.title.trim(),
      description: state.description.trim() || null,
      housing: {
        subtype: state.housingSubtype as "sublet" | "passdown",
        side: state.side as "offering" | "looking",
        monthlyRent: parseFloat(state.monthlyRent),
        bedrooms: state.bedrooms as any,
        bathrooms: state.bathrooms as any,
        neighborhood: state.neighborhood || null,
        amenities: state.amenities,
        roommates: state.roommates as any,
        roommateCount: state.roommates === "shared" ? parseInt(state.roommateCount) || null : null,
        moveInDate: state.housingSubtype === "sublet" ? state.moveInDate || null : null,
        moveOutDate: state.housingSubtype === "sublet" ? state.moveOutDate || null : null,
        leaseStartDate: state.housingSubtype === "passdown" ? state.leaseStartDate || null : null,
        leaseDurationMonths: state.housingSubtype === "passdown" ? parseInt(state.leaseDurationMonths) || null : null,
      },
    } as any;
  }, [state]);

  const submit = useCallback(async (): Promise<string | null> => {
    setState((prev) => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const payload = buildPayload();
      const post = await api.posts.create(payload);
      // Upload images if any
      if (state.images.length > 0) {
        const formData = new FormData();
        state.images.forEach((uri, i) => {
          formData.append("images", {
            uri,
            name: `photo_${i}.jpg`,
            type: "image/jpeg",
          } as any);
        });
        await api.posts.uploadImages(post.id, formData);
      }
      setState(INITIAL_STATE);
      return post.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create post";
      setState((prev) => ({ ...prev, isSubmitting: false, error: message }));
      return null;
    }
  }, [buildPayload, state.images]);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  return { ...state, update, goToStep, nextStep, prevStep, canAdvance, submit, reset };
}

function validateStep4(state: WizardState): boolean {
  if (state.type === "marketplace") {
    return !!(state.side && state.category && state.condition) &&
      (state.priceType !== "fixed" || !!state.priceAmount);
  }
  if (state.type === "storage") {
    return !!(state.side && state.startDate && state.endDate && state.size);
  }
  if (state.type === "housing") {
    const base = !!(state.side && state.monthlyRent && state.bedrooms && state.bathrooms && state.roommates);
    if (state.housingSubtype === "sublet") return base && !!(state.moveInDate && state.moveOutDate);
    if (state.housingSubtype === "passdown") return base && !!(state.leaseStartDate && state.leaseDurationMonths);
    return false;
  }
  return false;
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/StepIndicator.tsx apps/mobile/components/ImagePickerGrid.tsx apps/mobile/components/TypeSelector.tsx apps/mobile/hooks/useCreatePost.ts
git commit -m "feat: create wizard components (StepIndicator, ImagePickerGrid, TypeSelector) + useCreatePost hook"
```

---

## Task 18: Create Post Wizard — Full Screen

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/create.tsx`

- [ ] **Step 1: Implement the full 5-step create wizard**

Rewrite `apps/mobile/app/(tabs)/create.tsx`:

```tsx
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MARKETPLACE_CATEGORIES, CONDITIONS, STORAGE_SIZES,
  HOUSING_AMENITIES, BEDROOM_OPTIONS, BATHROOM_OPTIONS, LEASE_DURATION_OPTIONS,
} from "@uchicago-marketplace/shared";
import { colors, getAccentColor } from "@/constants/colors";
import { useCreatePost } from "@/hooks/useCreatePost";
import { StepIndicator } from "@/components/StepIndicator";
import { ImagePickerGrid } from "@/components/ImagePickerGrid";
import { TypeSelector } from "@/components/TypeSelector";

const STEPS = ["Photos", "Type", "Info", "Details", "Review"];

export default function CreateScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const wizard = useCreatePost();
  const accent = wizard.type ? getAccentColor(wizard.type) : colors.maroon[600];

  const handleSubmit = async () => {
    const postId = await wizard.submit();
    if (postId) {
      Alert.alert("Published!", "Your post is now live.", [
        { text: "View Post", onPress: () => router.push(`/posts/${postId}`) },
        { text: "OK" },
      ]);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.screenTitle}>Create Post</Text>
      <StepIndicator steps={STEPS} currentStep={wizard.step} onStepPress={wizard.goToStep} />
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {wizard.step === 1 && <Step1Photos wizard={wizard} />}
        {wizard.step === 2 && <Step2Type wizard={wizard} />}
        {wizard.step === 3 && <Step3Info wizard={wizard} />}
        {wizard.step === 4 && <Step4Details wizard={wizard} />}
        {wizard.step === 5 && <Step5Review wizard={wizard} />}
      </ScrollView>
      {wizard.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{wizard.error}</Text>
        </View>
      )}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        {wizard.step > 1 && (
          <Pressable style={styles.backBtn} onPress={wizard.prevStep}>
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
        )}
        {wizard.step === 1 && wizard.images.length === 0 && (
          <Pressable style={[styles.skipBtn, { marginLeft: "auto" }]} onPress={wizard.nextStep}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>
        )}
        {wizard.step < 5 ? (
          <Pressable
            style={[styles.nextBtn, { backgroundColor: accent }, !wizard.canAdvance() && styles.disabled]}
            onPress={wizard.nextStep}
            disabled={!wizard.canAdvance()}
          >
            <Text style={styles.nextBtnText}>Next</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.nextBtn, { backgroundColor: accent }, wizard.isSubmitting && styles.disabled]}
            onPress={handleSubmit}
            disabled={wizard.isSubmitting}
          >
            <Text style={styles.nextBtnText}>{wizard.isSubmitting ? "Publishing..." : "Publish Post"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Step1Photos({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  return (
    <View>
      <Text style={styles.stepTitle}>Add Photos</Text>
      <Text style={styles.stepSubtitle}>Photos help your post get more attention</Text>
      <ImagePickerGrid images={wizard.images} onImagesChange={(images) => wizard.update({ images })} />
    </View>
  );
}

function Step2Type({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  return (
    <View>
      <Text style={styles.stepTitle}>What are you posting?</Text>
      <TypeSelector
        selectedType={wizard.type}
        onSelectType={(type) => wizard.update({ type: type as any })}
        selectedSubtype={wizard.housingSubtype}
        onSelectSubtype={(subtype) => wizard.update({ housingSubtype: subtype as any })}
      />
    </View>
  );
}

function Step3Info({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.stepTitle}>Basic Info</Text>
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={wizard.title}
        onChangeText={(title) => wizard.update({ title })}
        placeholder="What are you listing?"
        maxLength={80}
      />
      <Text style={styles.charCount}>{wizard.title.length}/80</Text>
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={wizard.description}
        onChangeText={(description) => wizard.update({ description })}
        placeholder="Add details..."
        multiline
        numberOfLines={4}
      />
    </View>
  );
}

function Step4Details({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  if (wizard.type === "marketplace") return <MarketplaceFields wizard={wizard} />;
  if (wizard.type === "storage") return <StorageFields wizard={wizard} />;
  if (wizard.type === "housing") return <HousingFields wizard={wizard} />;
  return null;
}

function MarketplaceFields({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.stepTitle}>Marketplace Details</Text>
      <Text style={styles.label}>Side *</Text>
      <ToggleRow
        options={[{ label: "Selling", value: "sell" }, { label: "Buying", value: "buy" }]}
        selected={wizard.side}
        onSelect={(side) => wizard.update({ side })}
      />
      <Text style={styles.label}>Category *</Text>
      <View style={styles.pickerRow}>
        {MARKETPLACE_CATEGORIES.map((c) => (
          <Pressable
            key={c}
            style={[styles.pickerChip, wizard.category === c && styles.pickerChipActive]}
            onPress={() => wizard.update({ category: c })}
          >
            <Text style={[styles.pickerChipText, wizard.category === c && styles.pickerChipTextActive]}>
              {c.split(" ")[0]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Condition *</Text>
      <View style={styles.pickerRow}>
        {CONDITIONS.map((c) => (
          <Pressable
            key={c.value}
            style={[styles.pickerChip, wizard.condition === c.value && styles.pickerChipActive]}
            onPress={() => wizard.update({ condition: c.value })}
          >
            <Text style={[styles.pickerChipText, wizard.condition === c.value && styles.pickerChipTextActive]}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Price Type *</Text>
      <ToggleRow
        options={[{ label: "Fixed", value: "fixed" }, { label: "Free", value: "free" }, { label: "Trade", value: "trade" }]}
        selected={wizard.priceType}
        onSelect={(priceType) => wizard.update({ priceType: priceType as any })}
      />
      {wizard.priceType === "fixed" && (
        <>
          <Text style={styles.label}>Price *</Text>
          <TextInput style={styles.input} value={wizard.priceAmount} onChangeText={(priceAmount) => wizard.update({ priceAmount })} placeholder="0.00" keyboardType="decimal-pad" />
        </>
      )}
      {wizard.priceType === "trade" && (
        <>
          <Text style={styles.label}>What do you want in trade?</Text>
          <TextInput style={styles.input} value={wizard.tradeDescription} onChangeText={(tradeDescription) => wizard.update({ tradeDescription })} placeholder="Looking for..." />
        </>
      )}
      <Text style={styles.label}>Tags (comma-separated)</Text>
      <TextInput style={styles.input} value={wizard.tags} onChangeText={(tags) => wizard.update({ tags })} placeholder="e.g. textbook, science" />
    </View>
  );
}

function StorageFields({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.stepTitle}>Storage Details</Text>
      <Text style={styles.label}>Side *</Text>
      <ToggleRow
        options={[{ label: "Has Space", value: "has_space" }, { label: "Need Storage", value: "need_storage" }]}
        selected={wizard.side}
        onSelect={(side) => wizard.update({ side })}
      />
      <Text style={styles.label}>Start Date *</Text>
      <TextInput style={styles.input} value={wizard.startDate} onChangeText={(startDate) => wizard.update({ startDate })} placeholder="YYYY-MM-DD" />
      <Text style={styles.label}>End Date *</Text>
      <TextInput style={styles.input} value={wizard.endDate} onChangeText={(endDate) => wizard.update({ endDate })} placeholder="YYYY-MM-DD" />
      <Text style={styles.label}>Size *</Text>
      <View style={styles.pickerRow}>
        {STORAGE_SIZES.map((s) => (
          <Pressable key={s.value} style={[styles.pickerChip, wizard.size === s.value && styles.pickerChipActive]} onPress={() => wizard.update({ size: s.value })}>
            <Text style={[styles.pickerChipText, wizard.size === s.value && styles.pickerChipTextActive]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Location *</Text>
      <ToggleRow
        options={[{ label: "On Campus", value: "on_campus" }, { label: "Off Campus", value: "off_campus" }]}
        selected={wizard.locationType}
        onSelect={(locationType) => wizard.update({ locationType })}
      />
      <Text style={styles.label}>Neighborhood</Text>
      <TextInput style={styles.input} value={wizard.neighborhood} onChangeText={(neighborhood) => wizard.update({ neighborhood })} placeholder="e.g. Hyde Park" />
      <Pressable style={styles.checkboxRow} onPress={() => wizard.update({ isFree: !wizard.isFree })}>
        <View style={[styles.checkbox, wizard.isFree && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>Free storage</Text>
      </Pressable>
      {!wizard.isFree && (
        <>
          <Text style={styles.label}>Monthly Price</Text>
          <TextInput style={styles.input} value={wizard.priceMonthly} onChangeText={(priceMonthly) => wizard.update({ priceMonthly })} placeholder="0.00" keyboardType="decimal-pad" />
        </>
      )}
    </View>
  );
}

function HousingFields({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  const isSublet = wizard.housingSubtype === "sublet";
  return (
    <View style={styles.formSection}>
      <Text style={styles.stepTitle}>Housing Details ({isSublet ? "Sublet" : "Passdown"})</Text>
      <Text style={styles.label}>Side *</Text>
      <ToggleRow
        options={[{ label: "Offering", value: "offering" }, { label: "Looking", value: "looking" }]}
        selected={wizard.side}
        onSelect={(side) => wizard.update({ side })}
      />
      <Text style={styles.label}>Monthly Rent *</Text>
      <TextInput style={styles.input} value={wizard.monthlyRent} onChangeText={(monthlyRent) => wizard.update({ monthlyRent })} placeholder="0.00" keyboardType="decimal-pad" />
      {isSublet ? (
        <>
          <Text style={styles.label}>Move-in Date *</Text>
          <TextInput style={styles.input} value={wizard.moveInDate} onChangeText={(moveInDate) => wizard.update({ moveInDate })} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>Move-out Date *</Text>
          <TextInput style={styles.input} value={wizard.moveOutDate} onChangeText={(moveOutDate) => wizard.update({ moveOutDate })} placeholder="YYYY-MM-DD" />
        </>
      ) : (
        <>
          <Text style={styles.label}>Lease Start Date *</Text>
          <TextInput style={styles.input} value={wizard.leaseStartDate} onChangeText={(leaseStartDate) => wizard.update({ leaseStartDate })} placeholder="YYYY-MM-DD" />
          <Text style={styles.label}>Lease Duration *</Text>
          <View style={styles.pickerRow}>
            {LEASE_DURATION_OPTIONS.map((d) => (
              <Pressable key={d.value} style={[styles.pickerChip, wizard.leaseDurationMonths === String(d.value) && styles.pickerChipActive]} onPress={() => wizard.update({ leaseDurationMonths: String(d.value) })}>
                <Text style={[styles.pickerChipText, wizard.leaseDurationMonths === String(d.value) && styles.pickerChipTextActive]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <Text style={styles.label}>Bedrooms *</Text>
      <View style={styles.pickerRow}>
        {BEDROOM_OPTIONS.map((b) => (
          <Pressable key={b.value} style={[styles.pickerChip, wizard.bedrooms === b.value && styles.pickerChipActive]} onPress={() => wizard.update({ bedrooms: b.value })}>
            <Text style={[styles.pickerChipText, wizard.bedrooms === b.value && styles.pickerChipTextActive]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Bathrooms *</Text>
      <View style={styles.pickerRow}>
        {BATHROOM_OPTIONS.map((b) => (
          <Pressable key={b.value} style={[styles.pickerChip, wizard.bathrooms === b.value && styles.pickerChipActive]} onPress={() => wizard.update({ bathrooms: b.value })}>
            <Text style={[styles.pickerChipText, wizard.bathrooms === b.value && styles.pickerChipTextActive]}>{b.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Neighborhood</Text>
      <TextInput style={styles.input} value={wizard.neighborhood} onChangeText={(neighborhood) => wizard.update({ neighborhood })} placeholder="e.g. Hyde Park" />
      <Text style={styles.label}>Amenities</Text>
      <View style={styles.pickerRow}>
        {HOUSING_AMENITIES.map((a) => {
          const selected = wizard.amenities.includes(a.value);
          return (
            <Pressable
              key={a.value}
              style={[styles.pickerChip, selected && styles.pickerChipActive]}
              onPress={() => {
                const amenities = selected
                  ? wizard.amenities.filter((v) => v !== a.value)
                  : [...wizard.amenities, a.value];
                wizard.update({ amenities });
              }}
            >
              <Text style={[styles.pickerChipText, selected && styles.pickerChipTextActive]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Roommates *</Text>
      <ToggleRow
        options={[{ label: "Solo", value: "solo" }, { label: "Shared", value: "shared" }]}
        selected={wizard.roommates}
        onSelect={(roommates) => wizard.update({ roommates })}
      />
      {wizard.roommates === "shared" && (
        <>
          <Text style={styles.label}>How many roommates?</Text>
          <TextInput style={styles.input} value={wizard.roommateCount} onChangeText={(roommateCount) => wizard.update({ roommateCount })} placeholder="1" keyboardType="number-pad" />
        </>
      )}
    </View>
  );
}

function Step5Review({ wizard }: { wizard: ReturnType<typeof useCreatePost> }) {
  return (
    <View style={styles.formSection}>
      <Text style={styles.stepTitle}>Review Your Post</Text>
      <ReviewRow label="Type" value={wizard.type ?? ""} />
      {wizard.type === "housing" && <ReviewRow label="Subtype" value={wizard.housingSubtype ?? ""} />}
      <ReviewRow label="Title" value={wizard.title} />
      {wizard.description && <ReviewRow label="Description" value={wizard.description} />}
      <ReviewRow label="Side" value={wizard.side} />
      {wizard.type === "marketplace" && (
        <>
          <ReviewRow label="Category" value={wizard.category} />
          <ReviewRow label="Condition" value={wizard.condition} />
          <ReviewRow label="Price" value={wizard.priceType === "fixed" ? `$${wizard.priceAmount}` : wizard.priceType} />
        </>
      )}
      {wizard.type === "storage" && (
        <>
          <ReviewRow label="Dates" value={`${wizard.startDate} – ${wizard.endDate}`} />
          <ReviewRow label="Size" value={wizard.size} />
          <ReviewRow label="Price" value={wizard.isFree ? "Free" : `$${wizard.priceMonthly}/mo`} />
        </>
      )}
      {wizard.type === "housing" && (
        <>
          <ReviewRow label="Rent" value={`$${wizard.monthlyRent}/mo`} />
          <ReviewRow label="Bedrooms" value={wizard.bedrooms} />
          <ReviewRow label="Bathrooms" value={wizard.bathrooms} />
          {wizard.amenities.length > 0 && <ReviewRow label="Amenities" value={wizard.amenities.join(", ")} />}
          <ReviewRow label="Roommates" value={wizard.roommates === "shared" ? `Shared (${wizard.roommateCount})` : "Solo"} />
        </>
      )}
      <Text style={styles.photoCount}>{wizard.images.length} photo(s) attached</Text>
    </View>
  );
}

function ToggleRow({ options, selected, onSelect }: { options: Array<{ label: string; value: string }>; selected: string; onSelect: (v: string) => void }) {
  return (
    <View style={styles.toggleRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[styles.toggleBtn, selected === opt.value && styles.toggleBtnActive]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[styles.toggleText, selected === opt.value && styles.toggleTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  screenTitle: { fontSize: 18, fontWeight: "700", color: colors.gray[900], paddingHorizontal: 16, paddingTop: 8 },
  scroll: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: "700", color: colors.gray[900], paddingHorizontal: 16, marginTop: 8 },
  stepSubtitle: { fontSize: 12, color: colors.gray[400], paddingHorizontal: 16, marginTop: 2 },
  formSection: { padding: 16, gap: 4 },
  label: { fontSize: 12, fontWeight: "600", color: colors.gray[700], marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.gray[300], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.gray[800], marginTop: 4 },
  textarea: { minHeight: 80, textAlignVertical: "top" },
  charCount: { fontSize: 10, color: colors.gray[400], textAlign: "right" },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: colors.gray[200] },
  pickerChipActive: { borderColor: colors.maroon[600], backgroundColor: colors.maroon[50] },
  pickerChipText: { fontSize: 12, color: colors.gray[600] },
  pickerChipTextActive: { color: colors.maroon[600], fontWeight: "600" },
  toggleRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: colors.gray[200], alignItems: "center" },
  toggleBtnActive: { borderColor: colors.maroon[600], backgroundColor: colors.maroon[50] },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.gray[500] },
  toggleTextActive: { color: colors.maroon[600] },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: colors.gray[300] },
  checkboxChecked: { backgroundColor: colors.maroon[600], borderColor: colors.maroon[600] },
  checkboxLabel: { fontSize: 13, color: colors.gray[700] },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  reviewLabel: { fontSize: 13, color: colors.gray[500] },
  reviewValue: { fontSize: 13, fontWeight: "600", color: colors.gray[800], maxWidth: "60%", textAlign: "right" },
  photoCount: { fontSize: 12, color: colors.gray[400], marginTop: 12, textAlign: "center" },
  footer: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.gray[100] },
  backBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  backBtnText: { fontSize: 14, fontWeight: "600", color: colors.gray[500] },
  skipBtn: { paddingVertical: 14 },
  skipBtnText: { fontSize: 13, color: colors.gray[400] },
  nextBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  nextBtnText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  disabled: { opacity: 0.5 },
  errorBanner: { backgroundColor: colors.maroon[50], paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: colors.maroon[600], fontSize: 12 },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/app/\(tabs\)/create.tsx
git commit -m "feat: 5-step create post wizard with marketplace, storage, and housing support"
```

---

## Task 19: Profile Placeholder + Final Cleanup

**Files:**
- Rewrite: `apps/mobile/app/(tabs)/profile.tsx`
- Update: `apps/mobile/app.json` (add expo-image-picker plugin)

- [ ] **Step 1: Implement profile placeholder**

Rewrite `apps/mobile/app/(tabs)/profile.tsx`:

```tsx
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { colors } from "@/constants/colors";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.avatarPlaceholder}>
        <FontAwesome name="user" size={40} color={colors.gray[300]} />
      </View>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Sign in to manage your posts, messages, and saved items.</Text>
      <View style={styles.button}>
        <Text style={styles.buttonText}>Sign in with Google</Text>
      </View>
      <Text style={styles.hint}>Coming in Phase 1 (Auth)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.white },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: colors.gray[100],
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.gray[900] },
  subtitle: { fontSize: 13, color: colors.gray[500], textAlign: "center", marginTop: 8, lineHeight: 18 },
  button: {
    marginTop: 20, backgroundColor: colors.maroon[600], paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 12, opacity: 0.5,
  },
  buttonText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  hint: { marginTop: 8, fontSize: 11, color: colors.gray[400] },
});
```

- [ ] **Step 2: Add expo-image-picker plugin to app.json**

In `apps/mobile/app.json`, update the plugins array:

```json
"plugins": ["expo-router", "expo-image-picker"]
```

- [ ] **Step 3: Add .superpowers/ to .gitignore**

Check if `.superpowers/` is in `.gitignore`, add if not:

```bash
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 4: Verify full app builds and runs**

```bash
cd /Users/alexnoh/Desktop/uchicago_emart
pnpm --filter @uchicago-marketplace/shared run build
cd apps/mobile && npx expo start --clear 2>&1 | head -20
```

Expected: Metro starts, all 5 tabs render, navigation works.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: profile placeholder, expo-image-picker plugin, cleanup"
```

---

## Task 20: Add TODOs to Planning Doc

**Files:**
- Modify: `planning/implementation.md`

- [ ] **Step 1: Add future TODOs**

Append to the end of `planning/implementation.md`:

```markdown
---

### Future TODOs (from Phase 2 Mobile)

- [ ] **Mobile-specific API layer**: Evaluate building a wrapper on top of the shared `ApiClient` for offline caching, retry on flaky WiFi, and optimistic updates
- [ ] **Web: migrate to shared ApiClient**: Web app uses raw `fetch` with duplicated `API_URL` + auth header patterns across 6+ files — should use `createApi()` from `@uchicago-marketplace/shared` for consistency
- [ ] **Date pickers**: Replace plain text date inputs in create wizard with proper native date pickers (`@react-native-community/datetimepicker` or similar)
- [ ] **Star ratings API**: Build ratings system so AuthorRow can display real ratings instead of being omitted
- [ ] **Edit/delete from mobile**: Wire up edit form and delete confirmation from the post detail overflow menu
- [ ] **Housing: web support**: Add housing type support to the web app's browse/create/detail/edit pages
```

- [ ] **Step 2: Commit**

```bash
git add planning/implementation.md
git commit -m "docs: add future TODOs for mobile API layer, web ApiClient migration, ratings"
```

---

## Summary

| Task | What it builds | Files changed |
|------|---------------|--------------|
| 1 | Housing DB schema | Prisma schema + migration |
| 2 | Shared housing types | `types/post.ts` |
| 3 | Shared housing schemas | `schemas/post.schema.ts` |
| 4 | Shared housing constants | `constants/categories.ts` |
| 5 | API housing support | `services/posts.service.ts` |
| 6 | Shared build + image upload | `api-client/posts.ts`, `client.ts` |
| 7 | Mobile foundation | colors, typography, auth, API client |
| 8 | Mobile tab navigation | 5-tab layout, placeholder screens |
| 9 | PostCard + badges | `PostCard`, `BadgeRow`, `AuthorRow` |
| 10 | Loading/empty/error states | Skeleton, EmptyState, ErrorState |
| 11 | Feed UI components | SearchBar, FilterChips, SortPicker, SegmentedControl |
| 12 | Feed hooks | `usePostsFeed`, `usePostDetail` |
| 13 | Marketplace feed | Full feed screen with filters |
| 14 | Storage feed | Full feed screen with side filters |
| 15 | Housing feed | Feed with segmented control |
| 16 | Post detail | Image carousel + type-specific detail |
| 17 | Create wizard components | StepIndicator, ImagePicker, TypeSelector, useCreatePost |
| 18 | Create wizard screen | Full 5-step wizard |
| 19 | Profile + cleanup | Placeholder profile, app.json update |
| 20 | Planning TODOs | Future work documented |
