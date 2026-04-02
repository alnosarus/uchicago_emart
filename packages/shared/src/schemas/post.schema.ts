import { z } from "zod";

const postTypeEnum = z.enum(["marketplace", "storage", "housing"]);
const postSideEnum = z.enum([
  "sell", "buy", "has_space", "need_storage", "offering", "looking",
]);
const priceTypeEnum = z.enum(["fixed", "free", "trade"]);
const conditionEnum = z.enum(["new", "like_new", "good", "fair", "for_parts", "unknown"]);
const storageSizeEnum = z.enum(["boxes", "half_room", "full_room"]);
const locationTypeEnum = z.enum(["on_campus", "off_campus"]);

export const marketplaceDetailsSchema = z.object({
  priceType: priceTypeEnum,
  priceAmount: z.number().min(0).nullable(),
  condition: conditionEnum,
  category: z.string().min(1, "Category is required"),
  tradeDescription: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export const storageDetailsSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  size: storageSizeEnum,
  locationType: locationTypeEnum,
  neighborhood: z.string().nullable().optional(),
  priceMonthly: z.number().min(0).nullable(),
  isFree: z.boolean().default(false),
  restrictions: z.string().nullable().optional(),
});

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

export const createPostSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("marketplace"),
    side: z.enum(["sell", "buy"]),
    title: z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    marketplace: marketplaceDetailsSchema,
  }),
  z.object({
    type: z.literal("storage"),
    side: z.enum(["has_space", "need_storage"]),
    title: z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    storage: storageDetailsSchema,
  }),
  z.object({
    type: z.literal("housing"),
    side: z.enum(["offering", "looking"]),
    title: z.string().min(1).max(80),
    description: z.string().nullable().optional(),
    housing: housingDetailsSchema,
  }),
]);

export const postQuerySchema = z.object({
  type: postTypeEnum.optional(),
  side: postSideEnum.optional(),
  q: z.string().optional(),
  category: z.string().optional(),
  size: storageSizeEnum.optional(),
  locationType: locationTypeEnum.optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  condition: conditionEnum.optional(),
  subtype: housingSubtypeEnum.optional(),
  bedrooms: bedroomsEnum.optional(),
  bathrooms: bathroomsEnum.optional(),
  sort: z.enum(["recent", "price_asc", "price_desc", "relevance"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type PostQueryInput = z.infer<typeof postQuerySchema>;
