import { useState, useCallback } from "react";
import { api } from "@/lib/api";

export function useSavedPosts() {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const isSaved = useCallback((postId: string) => savedIds.has(postId), [savedIds]);

  const toggleSave = useCallback(async (postId: string) => {
    const wasSaved = savedIds.has(postId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(postId) : next.add(postId);
      return next;
    });
    try {
      wasSaved ? await api.saved.unsave(postId) : await api.saved.save(postId);
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(postId) : next.delete(postId);
        return next;
      });
    }
  }, [savedIds]);

  const initSavedState = useCallback((postId: string, saved: boolean) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      saved ? next.add(postId) : next.delete(postId);
      return next;
    });
  }, []);

  return { isSaved, toggleSave, initSavedState };
}
