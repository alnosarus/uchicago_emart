import type { UserSearchResult, UserProfile, UserProfilePrivate } from "../types/user";
import type { ApiClient } from "./client";

export function createUsersApi(client: ApiClient) {
  return {
    search(query: string) {
      return client.request<UserSearchResult[]>("/api/users/search", {
        params: { q: query },
      });
    },
    getProfile(userId: string) {
      return client.request<UserProfile>(`/api/users/${userId}`);
    },
    getMyProfile() {
      return client.request<UserProfilePrivate>("/api/users/me/profile");
    },
  };
}
