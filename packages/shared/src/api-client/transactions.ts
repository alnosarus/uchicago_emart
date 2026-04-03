import type { TransactionWithDetails } from "../types/transaction";
import type { ApiClient } from "./client";

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
  };
}
