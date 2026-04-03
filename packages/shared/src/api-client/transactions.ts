import type { TransactionWithDetails } from "../types/transaction";
import type { ApiClient } from "./client";

export interface TransactionHistoryItem extends TransactionWithDetails {
  role: "seller" | "buyer";
  counterparty: { id: string; name: string; cnetId: string; avatarUrl: string | null };
}

export function createTransactionsApi(client: ApiClient) {
  return {
    create(data: { postId: string; buyerId: string }) {
      return client.request<TransactionWithDetails>("/api/transactions", {
        method: "POST",
        body: data,
      });
    },
    undo(postId: string) {
      return client.request<void>(`/api/transactions/${postId}`, {
        method: "DELETE",
      });
    },
    history(params?: { page?: number; limit?: number }) {
      return client.request<{ data: TransactionHistoryItem[]; total: number }>(
        "/api/transactions/history",
        { params: params as Record<string, string | number | boolean | undefined> },
      );
    },
  };
}
