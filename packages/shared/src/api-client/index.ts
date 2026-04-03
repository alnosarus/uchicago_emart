import { ApiClient } from "./client";
import { createAuthApi } from "./auth";
import { createPostsApi } from "./posts";
import { createUsersApi } from "./users";
import { createTransactionsApi } from "./transactions";
import { createReviewsApi } from "./reviews";
import { createSavedApi } from "./saved";

export { ApiClient, ApiError } from "./client";
export type { ReviewEligibility } from "./reviews";
export type { TransactionHistoryItem } from "./transactions";

export function createApi(baseUrl: string, getToken: () => string | null) {
  const client = new ApiClient(baseUrl, getToken);

  return {
    auth: createAuthApi(client),
    posts: createPostsApi(client),
    users: createUsersApi(client),
    transactions: createTransactionsApi(client),
    reviews: createReviewsApi(client),
    saved: createSavedApi(client),
  };
}

export type Api = ReturnType<typeof createApi>;
