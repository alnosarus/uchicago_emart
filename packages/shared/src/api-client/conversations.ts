import type { Conversation, ConversationWithDetails, Message } from "../types/message";
import type { ApiClient } from "./client";

export function createConversationsApi(client: ApiClient) {
  return {
    list() {
      return client.request<{ data: ConversationWithDetails[] }>("/api/conversations");
    },

    create(postId: string) {
      return client.request<Conversation>("/api/conversations", {
        method: "POST",
        body: { postId },
      });
    },

    get(conversationId: string) {
      return client.request<ConversationWithDetails>(`/api/conversations/${conversationId}`);
    },

    getMessages(conversationId: string, params?: { before?: string; limit?: number }) {
      return client.request<{ data: Message[]; hasMore: boolean }>(
        `/api/conversations/${conversationId}/messages`,
        { params: params as Record<string, string | number | boolean | undefined> },
      );
    },

    sendMessage(conversationId: string, body: string) {
      return client.request<Message>(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body },
      });
    },

    markRead(conversationId: string) {
      return client.request<void>(`/api/conversations/${conversationId}/read`, {
        method: "PATCH",
      });
    },
  };
}
