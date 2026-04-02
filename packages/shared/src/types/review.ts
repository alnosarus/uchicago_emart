export interface Review {
  id: string;
  postId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  text: string | null;
  createdAt: Date;
}

export interface ReviewWithAuthor extends Review {
  reviewer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
