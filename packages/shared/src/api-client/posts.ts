import type { PostWithDetails } from "../types/post";
import type { PostQueryInput, CreatePostInput } from "../schemas/post.schema";
import { ApiClient, ApiError } from "./client";

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

    async uploadImages(postId: string, formData: FormData): Promise<{ urls: string[] }> {
      const token = client.getToken();
      const response = await fetch(`${client.baseUrl}/api/posts/${postId}/images`, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }));
        throw new ApiError(response.status, error.message);
      }
      return response.json();
    },

    async deleteImage(imageId: string): Promise<void> {
      await client.request<void>(`/api/posts/images/${imageId}`, {
        method: "DELETE",
      });
    },

    async reorderImages(postId: string, imageIds: string[]): Promise<void> {
      await client.request<void>(`/api/posts/${postId}/images/reorder`, {
        method: "PATCH",
        body: { imageIds },
      });
    },
  };
}
