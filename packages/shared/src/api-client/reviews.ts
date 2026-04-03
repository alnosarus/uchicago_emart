import type { ReviewWithAuthor } from "../types/review";
import type { CreateReviewInput } from "../schemas/review.schema";
import type { ApiClient } from "./client";

export interface ReviewEligibility {
  eligible: boolean;
  revieweeId?: string;
  revieweeName?: string;
  alreadyReviewed: boolean;
}

export function createReviewsApi(client: ApiClient) {
  return {
    create(data: CreateReviewInput) {
      return client.request<ReviewWithAuthor>("/api/reviews", {
        method: "POST",
        body: data,
      });
    },
    getForUser(userId: string, params?: { page?: number; limit?: number }) {
      return client.request<{
        data: ReviewWithAuthor[];
        total: number;
        averageRating: number | null;
      }>(`/api/users/${userId}/reviews`, {
        params: params as Record<string, string | number | boolean | undefined>,
      });
    },
    checkEligibility(postId: string) {
      return client.request<ReviewEligibility>("/api/reviews/eligibility", {
        params: { postId },
      });
    },
  };
}
