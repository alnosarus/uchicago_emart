import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { ReviewEligibility } from "@uchicago-marketplace/shared";

export function useReview(postId: string | undefined, postStatus: string | undefined) {
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId || (postStatus !== "sold" && postStatus !== "completed")) return;
    api.reviews.checkEligibility(postId).then(setEligibility).catch(() => {});
  }, [postId, postStatus]);

  async function submitReview(data: { postId: string; revieweeId: string; rating: number; text?: string | null }): Promise<boolean> {
    setIsSubmitting(true);
    setError(null);
    try {
      await api.reviews.create(data);
      setEligibility((prev) => prev ? { ...prev, eligible: false, alreadyReviewed: true } : null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  return { eligibility, submitReview, isSubmitting, error };
}
