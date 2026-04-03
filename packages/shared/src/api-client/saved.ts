import type { PostWithDetails } from "../types/post";
import type { ApiClient } from "./client";

export function createSavedApi(client: ApiClient) {
  return {
    save(postId: string) {
      return client.request<{ saved: true }>(`/api/saved/${postId}`, {
        method: "POST",
      });
    },
    unsave(postId: string) {
      return client.request<void>(`/api/saved/${postId}`, {
        method: "DELETE",
      });
    },
    list(params?: { page?: number; limit?: number }) {
      return client.request<{ data: PostWithDetails[]; total: number }>(
        "/api/saved",
        { params: params as Record<string, string | number | boolean | undefined> },
      );
    },
  };
}
