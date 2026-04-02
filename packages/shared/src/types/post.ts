export type PostType = "marketplace" | "storage";

export type PostSide =
  | "sell"
  | "buy"
  | "has_space"
  | "need_storage";

export type PostStatus = "active" | "sold" | "completed" | "expired" | "deleted";

export type PriceType = "fixed" | "free" | "trade";
export type Condition = "new" | "like_new" | "good" | "fair" | "for_parts" | "unknown";
export type StorageSize = "boxes" | "half_room" | "full_room";
export type LocationType = "on_campus" | "off_campus";

export interface Post {
  id: string;
  authorId: string;
  type: PostType;
  side: PostSide;
  status: PostStatus;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  images: PostImage[];
}

export interface PostImage {
  id: string;
  postId: string;
  url: string;
  order: number;
}

export interface MarketplaceDetails {
  postId: string;
  priceType: PriceType;
  priceAmount: number | null;
  condition: Condition;
  category: string;
  tradeDescription: string | null;
  tags: string[];
}

export interface StorageDetails {
  postId: string;
  startDate: Date;
  endDate: Date;
  size: StorageSize;
  locationType: LocationType;
  neighborhood: string | null;
  priceMonthly: number | null;
  isFree: boolean;
  restrictions: string | null;
}

export interface PostWithDetails extends Post {
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  marketplace?: MarketplaceDetails;
  storage?: StorageDetails;
}
