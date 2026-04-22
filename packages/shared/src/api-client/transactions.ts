import type { TransactionWithDetails } from "../types/transaction";
import type { ApiClient } from "./client";

export interface TransactionHistoryItem extends TransactionWithDetails {
  role: "seller" | "buyer";
  counterparty: { id: string; name: string; cnetId: string; avatarUrl: string | null };
  hasReviewed: boolean;
  myRating: number | null;
  revieweeId: string;
}

export function createTransactionsApi(client: ApiClient) {
  return {
    // Seller marks as sold
    create(data: { postId: string; buyerId: string }) {
      return client.request<TransactionWithDetails>("/api/transactions", {
        method: "POST",
        body: data,
      });
    },
    // Buyer marks as bought (requires message history)
    buyerInitiate(data: { postId: string }) {
      return client.request<TransactionWithDetails>("/api/transactions/buyer", {
        method: "POST",
        body: data,
      });
    },
    // Confirm the pending transaction
    confirm(postId: string) {
      return client.request<TransactionWithDetails>(`/api/transactions/${postId}/confirm`, {
        method: "PATCH",
      });
    },
    undo(postId: string) {
      return client.request<void>(`/api/transactions/${postId}`, {
        method: "DELETE",
      });
    },
    getByPostId(postId: string) {
      return client.request<TransactionWithDetails>(`/api/transactions/${postId}`);
    },
    history(params?: { page?: number; limit?: number; with?: string }) {
      return client.request<{ data: TransactionHistoryItem[]; total: number }>(
        "/api/transactions/history",
        { params: params as Record<string, string | number | boolean | undefined> },
      );
    },
  };
}
