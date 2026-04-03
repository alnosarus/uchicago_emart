import { useState } from "react";
import { api } from "@/lib/api";
import type { TransactionWithDetails } from "@uchicago-marketplace/shared";

export function useTransaction() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTransaction(postId: string, buyerId: string): Promise<TransactionWithDetails | null> {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.transactions.create({ postId, buyerId });
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete transaction");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function undoTransaction(postId: string): Promise<boolean> {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.transactions.undo(postId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo transaction");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { createTransaction, undoTransaction, isSubmitting, error };
}
