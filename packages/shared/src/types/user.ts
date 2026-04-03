export interface User {
  id: string;
  email: string;
  name: string;
  cnetId: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  googleId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
}

export interface UserSearchResult {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
}

export interface UserProfileStats {
  averageRating: number | null;
  reviewCount: number;
  transactionCount: number;
  activeListingCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
  stats: UserProfileStats;
  activePosts: import("./post").PostWithDetails[];
  reviews: {
    data: import("./review").ReviewWithAuthor[];
    total: number;
  };
}

export interface UserProfilePrivate extends UserProfile {
  email: string;
  phone: string | null;
}
