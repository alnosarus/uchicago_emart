import { ApiClient } from "./client";
import { createAuthApi } from "./auth";
import { createPostsApi } from "./posts";

export { ApiClient, ApiError } from "./client";

export function createApi(baseUrl: string, getToken: () => string | null) {
  const client = new ApiClient(baseUrl, getToken);

  return {
    auth: createAuthApi(client),
    posts: createPostsApi(client),
  };
}

export type Api = ReturnType<typeof createApi>;
