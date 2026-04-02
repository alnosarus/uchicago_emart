import type { PostWithDetails } from "../types/post";
import type { PostQueryInput, CreatePostInput } from "../schemas/post.schema";
import { ApiClient } from "./client";

export function createPostsApi(client: ApiClient) {
  return {
    list(query?: Partial<PostQueryInput>) {
      return client.request<{ data: PostWithDetails[]; total: number }>(
        "/api/posts",
        { params: query as Record<string, string | number | boolean | undefined> }
      );
    },

    get(id: string) {
      return client.request<PostWithDetails>(`/api/posts/${id}`);
    },

    create(data: CreatePostInput) {
      return client.request<PostWithDetails>("/api/posts", {
        method: "POST",
        body: data,
      });
    },

    update(id: string, data: Partial<CreatePostInput>) {
      return client.request<PostWithDetails>(`/api/posts/${id}`, {
        method: "PATCH",
        body: data,
      });
    },

    delete(id: string) {
      return client.request<void>(`/api/posts/${id}`, { method: "DELETE" });
    },

    updateStatus(id: string, status: string) {
      return client.request<PostWithDetails>(`/api/posts/${id}/status`, {
        method: "PATCH",
        body: { status },
      });
    },
  };
}
