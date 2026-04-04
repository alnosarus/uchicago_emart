export type PostType = "marketplace" | "storage" | "housing";

export type PostSide =
  | "sell"
  | "buy"
  | "has_space"
  | "need_storage"
  | "offering"
  | "looking";

export type PostStatus = "active" | "sold" | "completed" | "expired" | "deleted";

export type PriceType = "fixed" | "free" | "trade";
export type Condition = "new" | "like_new" | "good" | "fair" | "for_parts" | "unknown";
export type StorageSize = "boxes" | "half_room" | "full_room";
export type LocationType = "on_campus" | "off_campus";

export type HousingSubtype = "sublet" | "passdown";
export type HousingSide = "offering" | "looking";
export type Bedrooms = "studio" | "1" | "2" | "3_plus";
export type Bathrooms = "1" | "1.5" | "2_plus";
export type RoommateType = "solo" | "shared";

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

export type ImageStatus = "processing" | "ready" | "failed";

export interface PostImage {
  id: string;
  postId: string;
  url: string;
  fullUrl: string | null;
  thumbUrl: string | null;
  blurHash: string | null;
  status: ImageStatus;
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
