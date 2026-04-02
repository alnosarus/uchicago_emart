import { useState, useEffect, useCallback } from "react";
import type { PostWithDetails } from "@uchicago-marketplace/shared";
import { api } from "@/lib/api";

interface UsePostDetailReturn {
  post: PostWithDetails | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePostDetail(id: string): UsePostDetailReturn {
  const [post, setPost] = useState<PostWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.posts.get(id);
      setPost(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load post");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  const refetch = useCallback(() => {
    fetchPost();
  }, [fetchPost]);

  return { post, isLoading, error, refetch };
}
