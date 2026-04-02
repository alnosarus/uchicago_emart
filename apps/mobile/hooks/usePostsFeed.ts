import { useState, useEffect, useCallback, useRef } from "react";
import type { PostWithDetails, PostQueryInput } from "@uchicago-marketplace/shared";
import { api } from "@/lib/api";

interface UsePostsFeedOptions {
  type?: PostQueryInput["type"];
  initialFilters?: Partial<PostQueryInput>;
}

interface UsePostsFeedReturn {
  posts: PostWithDetails[];
  isLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  refresh: () => void;
  loadMore: () => void;
  filters: Partial<PostQueryInput>;
  updateFilters: (newFilters: Partial<PostQueryInput>) => void;
}

const PAGE_SIZE = 20;

export function usePostsFeed(options: UsePostsFeedOptions = {}): UsePostsFeedReturn {
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Partial<PostQueryInput>>({
    ...options.initialFilters,
    ...(options.type ? { type: options.type } : {}),
  });
  const pageRef = useRef(1);

  const fetchPosts = useCallback(
    async (page: number, append: boolean) => {
      try {
        const response = await api.posts.list({
          ...filters,
          page,
          limit: PAGE_SIZE,
        });

        // Handle both possible API response shapes
        let data: PostWithDetails[];
        let responseTotal: number;

        if ("data" in response && Array.isArray(response.data)) {
          data = response.data;
          responseTotal = response.total;
        } else if (
          "posts" in (response as Record<string, unknown>) &&
          Array.isArray((response as Record<string, unknown>).posts)
        ) {
          const alt = response as unknown as {
            posts: PostWithDetails[];
            pagination: { total: number; totalPages: number };
          };
          data = alt.posts;
          responseTotal = alt.pagination.total;
        } else {
          data = [];
          responseTotal = 0;
        }

        if (append) {
          setPosts((prev) => [...prev, ...data]);
        } else {
          setPosts(data);
        }
        setTotal(responseTotal);
        setHasMore(data.length === PAGE_SIZE);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load posts");
      }
    },
    [filters]
  );

  // Fetch on filter change (reset to page 1)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      pageRef.current = 1;
      await fetchPosts(1, false);
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [fetchPosts]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    pageRef.current = 1;
    await fetchPosts(1, false);
    setIsRefreshing(false);
  }, [fetchPosts]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    await fetchPosts(nextPage, true);
    setIsLoadingMore(false);
  }, [isLoadingMore, hasMore, fetchPosts]);

  const updateFilters = useCallback((newFilters: Partial<PostQueryInput>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  return {
    posts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    error,
    hasMore,
    total,
    refresh,
    loadMore,
    filters,
    updateFilters,
  };
}
