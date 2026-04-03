import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";
import type { Prisma } from "@prisma/client";

// Prisma enum uses "new_item" but the API/schema uses "new"
function mapCondition(condition: string): string {
  if (condition === "new") return "new_item";
  return condition;
}

// ── Create ──────────────────────────────────────

interface CreatePostInput {
  authorId: string;
  type: "marketplace" | "storage" | "housing";
  side: string;
  title: string;
  description?: string;
  marketplace?: {
    priceType: string;
    priceAmount?: number | null;
    condition: string;
    category: string;
    tradeDescription?: string | null;
    tags?: string[];
  };
  storage?: {
    startDate: string;
    endDate: string;
    size: string;
    locationType: string;
    neighborhood?: string | null;
    priceMonthly?: number | null;
    isFree?: boolean;
    restrictions?: string | null;
  };
  housing?: {
    subtype: string;
    side: string;
    monthlyRent?: number | null;
    bedrooms: number;
    bathrooms: number;
    neighborhood?: string | null;
    amenities?: string[];
    roommates: boolean;
    roommateCount?: number | null;
    moveInDate?: string | null;
    moveOutDate?: string | null;
    leaseStartDate?: string | null;
    leaseDurationMonths?: number | null;
  };
  imageUrls?: string[];
}

export async function createPost(input: CreatePostInput) {
  const { authorId, type, side, title, description, marketplace, storage, housing, imageUrls } = input;

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
      ...(housing && {
        housing: {
          create: {
            subtype: housing.subtype,
            side: housing.side,
            monthlyRent: housing.monthlyRent ?? null,
            bedrooms: housing.bedrooms,
            bathrooms: housing.bathrooms,
            neighborhood: housing.neighborhood ?? null,
            amenities: housing.amenities ?? [],
            roommates: housing.roommates,
            roommateCount: housing.roommateCount ?? null,
            moveInDate: housing.moveInDate ? new Date(housing.moveInDate) : null,
            moveOutDate: housing.moveOutDate ? new Date(housing.moveOutDate) : null,
            leaseStartDate: housing.leaseStartDate ? new Date(housing.leaseStartDate) : null,
            leaseDurationMonths: housing.leaseDurationMonths ?? null,
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

// ── List ───────────────────────────────────────

interface ListPostsInput {
  type?: string;
  side?: string;
  q?: string;
  category?: string;
  size?: string;
  locationType?: string;
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  subtype?: string;
  bedrooms?: number;
  bathrooms?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function listPosts(input: ListPostsInput) {
  const {
    type, side, q, category, size, locationType,
    priceMin, priceMax, condition,
    subtype, bedrooms, bathrooms,
    sort = "recent",
    page = 1,
    limit = 20,
  } = input;

  // Build marketplace filter as single object to avoid spread overwrites
  const marketplaceWhere: Record<string, any> = {};
  if (category) marketplaceWhere.category = category;
  if (condition) marketplaceWhere.condition = mapCondition(condition);
  if (priceMin !== undefined || priceMax !== undefined) {
    marketplaceWhere.priceAmount = {
      ...(priceMin !== undefined && { gte: priceMin }),
      ...(priceMax !== undefined && { lte: priceMax }),
    };
  }

  // Build storage filter as single object
  const storageWhere: Record<string, any> = {};
  if (size) storageWhere.size = size;
  if (locationType) storageWhere.locationType = locationType;
  if (priceMin !== undefined || priceMax !== undefined) {
    storageWhere.priceMonthly = {
      ...(priceMin !== undefined && { gte: priceMin }),
      ...(priceMax !== undefined && { lte: priceMax }),
    };
  }

  const where: Prisma.PostWhereInput = {
    status: "active",
    ...(type && { type: type as any }),
    ...(side && { side: side as any }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(Object.keys(marketplaceWhere).length > 0 && { marketplace: marketplaceWhere }),
    ...(Object.keys(storageWhere).length > 0 && { storage: storageWhere }),
  };

  // Build housing filter
  if (subtype || bedrooms || bathrooms || (type === "housing" && (priceMin !== undefined || priceMax !== undefined))) {
    const housingWhere: Record<string, unknown> = {};
    if (subtype) housingWhere.subtype = subtype;
    if (bedrooms) housingWhere.bedrooms = bedrooms;
    if (bathrooms) housingWhere.bathrooms = bathrooms;
    if (priceMin !== undefined || priceMax !== undefined) {
      housingWhere.monthlyRent = {
        ...(priceMin !== undefined && { gte: priceMin }),
        ...(priceMax !== undefined && { lte: priceMax }),
      };
    }
    if (Object.keys(housingWhere).length > 0) {
      where.housing = housingWhere;
    }
  }

  const orderBy: Prisma.PostOrderByWithRelationInput =
    sort === "price_asc" ? { marketplace: { priceAmount: "asc" } } :
    sort === "price_desc" ? { marketplace: { priceAmount: "desc" } } :
    { createdAt: "desc" };

  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
        marketplace: true,
        storage: true,
        housing: true,
        images: { orderBy: { order: "asc" }, take: 1 },
        _count: { select: { savedBy: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── Get Detail ────────────────────────────────

export async function getPostById(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
      marketplace: true,
      storage: true,
      housing: true,
      images: { orderBy: { order: "asc" } },
      _count: { select: { savedBy: true } },
    },
  });

  if (!post) throw new HttpError(404, "Post not found");
  if (post.status === "deleted") throw new HttpError(404, "Post not found");

  return post;
}

// ── Update ────────────────────────────────────

interface UpdatePostInput {
  title?: string;
  description?: string;
  marketplace?: {
    priceType?: string;
    priceAmount?: number | null;
    condition?: string;
    category?: string;
    tradeDescription?: string | null;
    tags?: string[];
  };
  storage?: {
    startDate?: string;
    endDate?: string;
    size?: string;
    locationType?: string;
    neighborhood?: string | null;
    priceMonthly?: number | null;
    isFree?: boolean;
    restrictions?: string | null;
  };
  housing?: {
    subtype?: string;
    side?: string;
    monthlyRent?: number | null;
    bedrooms?: number;
    bathrooms?: number;
    neighborhood?: string | null;
    amenities?: string[];
    roommates?: boolean;
    roommateCount?: number | null;
    moveInDate?: string | null;
    moveOutDate?: string | null;
    leaseStartDate?: string | null;
    leaseDurationMonths?: number | null;
  };
}

export async function updatePost(postId: string, userId: string, input: UpdatePostInput) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "Not authorized to edit this post");
  if (post.status === "deleted") throw new HttpError(404, "Post not found");

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
            ...input.housing,
            ...(input.housing.moveInDate && { moveInDate: new Date(input.housing.moveInDate) }),
            ...(input.housing.moveOutDate && { moveOutDate: new Date(input.housing.moveOutDate) }),
            ...(input.housing.leaseStartDate && { leaseStartDate: new Date(input.housing.leaseStartDate) }),
          },
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

// ── Delete (soft) ─────────────────────────────

export async function deletePost(postId: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "Not authorized to delete this post");

  await prisma.post.update({
    where: { id: postId },
    data: { status: "deleted" },
  });
}

// ── Add Images ────────────────────────────────

export async function addPostImages(postId: string, userId: string, imageUrls: string[]) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "Not authorized");

  const existing = await prisma.postImage.count({ where: { postId } });

  return prisma.postImage.createMany({
    data: imageUrls.map((url, i) => ({
      postId,
      url,
      order: existing + i,
    })),
  });
}

export async function deletePostImage(imageId: string, userId: string) {
  const image = await prisma.postImage.findUnique({
    where: { id: imageId },
    include: { post: { select: { authorId: true } } },
  });
  if (!image) throw new HttpError(404, "Image not found");
  if (image.post.authorId !== userId) throw new HttpError(403, "Not authorized");

  await prisma.postImage.delete({ where: { id: imageId } });
}
