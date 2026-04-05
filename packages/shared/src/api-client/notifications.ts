import type { Notification } from "../types/notification";
import type { ApiClient } from "./client";

export interface NotificationsResponse {
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function createNotificationsApi(client: ApiClient) {
  return {
    list(page: number = 1, limit: number = 20) {
      return client.request<NotificationsResponse>("/api/notifications", {
        params: { page, limit } as Record<string, string | number | boolean | undefined>,
      });
    },

    getUnreadCount() {
      return client.request<{ count: number }>("/api/notifications/unread-count");
    },

    markAsRead(id: string) {
      return client.request<Notification>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
    },

    markAllAsRead() {
      return client.request<{ success: boolean }>("/api/notifications/read-all", {
        method: "PATCH",
      });
    },
  };
}
