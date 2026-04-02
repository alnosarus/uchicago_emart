"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";

// ── Constants ────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const CATEGORIES = [
  "Textbooks",
  "Electronics",
  "Furniture",
  "Clothing",
  "Lab Supplies",
  "Sports",
  "Music",
  "Services & Tutoring",
  "Other",
] as const;

const CONDITIONS: { value: string; label: string }[] = [
  { value: "new_item", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For Parts" },
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

const TYPE_TABS = [
  { value: "", label: "All" },
  { value: "marketplace", label: "Marketplace" },
  { value: "storage", label: "Storage" },
] as const;

// ── Types ────────────────────────────────────────

interface PostAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface MarketplaceDetails {
  priceType: "fixed" | "free" | "trade";
  priceAmount: number | null;
  condition: string;
  category: string;
}

interface StorageDetails {
  startDate: string;
  endDate: string;
  size: string;
  locationType: string;
  priceMonthly: number | null;
  isFree: boolean;
}

interface PostImage {
  url: string;
}

interface Post {
  id: string;
  title: string;
  description: string | null;
  type: "marketplace" | "storage";
  side: string;
  status: string;
  createdAt: string;
  author: PostAuthor;
  marketplace: MarketplaceDetails | null;
  storage: StorageDetails | null;
  images: PostImage[];
  _count: { savedBy: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PostsResponse {
  posts: Post[];
  pagination: Pagination;
}

// ── Helpers ──────────────────────────────────────

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatPrice(post: Post): { text: string; isFree: boolean } {
  if (post.type === "marketplace" && post.marketplace) {
    if (post.marketplace.priceType === "free") return { text: "Free", isFree: true };
    if (post.marketplace.priceType === "trade") return { text: "Trade", isFree: false };
    if (post.marketplace.priceAmount != null) {
      return { text: `$${post.marketplace.priceAmount.toFixed(2)}`, isFree: false };
    }
    return { text: "Price TBD", isFree: false };
  }
  if (post.type === "storage" && post.storage) {
    if (post.storage.isFree) return { text: "Free", isFree: true };
    if (post.storage.priceMonthly != null) {
      return { text: `$${post.storage.priceMonthly.toFixed(2)}/mo`, isFree: false };
    }
    return { text: "Price TBD", isFree: false };
  }
  return { text: "", isFree: false };
}

function conditionLabel(condition: string): string {
  const map: Record<string, string> = {
    new_item: "New",
    new: "New",
    like_new: "Like New",
    good: "Good",
    fair: "Fair",
    for_parts: "For Parts",
    unknown: "Unknown",
  };
  return map[condition] || condition;
}

// ── Components ───────────────────────────────────

function PostCard({ post }: { post: Post }) {
  const price = formatPrice(post);
  const imageUrl = post.images.length > 0 ? post.images[0].url : null;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}

        {/* Type badge */}
        <span
          className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
            post.type === "storage"
              ? "bg-amber-100 text-amber-700"
              : "bg-maroon-100 text-maroon-700"
          }`}
        >
          {post.type === "storage" ? "Storage" : "Marketplace"}
        </span>

        {/* Save count */}
        {post._count.savedBy > 0 && (
          <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
            {post._count.savedBy}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5">
        {/* Price badge */}
        {price.text && (
          <span
            className={`inline-block text-sm font-bold mb-1.5 px-2 py-0.5 rounded ${
              price.isFree
                ? "bg-green-100 text-green-700"
                : "bg-maroon-100 text-maroon-700"
            }`}
          >
            {price.text}
          </span>
        )}

        {/* Title */}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-maroon-700 transition-colors">
          {post.title}
        </h3>

        {/* Condition (marketplace only) */}
        {post.marketplace?.condition && post.marketplace.condition !== "unknown" && (
          <p className="text-xs text-gray-500 mt-1">
            {conditionLabel(post.marketplace.condition)}
          </p>
        )}

        {/* Storage size (storage only) */}
        {post.storage && (
          <p className="text-xs text-gray-500 mt-1">
            {post.storage.size === "boxes" ? "Boxes" : post.storage.size === "half_room" ? "Half Room" : "Full Room"}
            {" / "}
            {post.storage.locationType === "on_campus" ? "On Campus" : "Off Campus"}
          </p>
        )}

        {/* Author + time */}
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-maroon-400 to-maroon-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {post.author.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
            <span className="text-xs text-gray-600 truncate">{post.author.name}</span>
            {post.author.isVerified && (
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{timeAgo(post.createdAt)}</span>
        </div>
      </div>
    </Link>
  );
}

function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: Pagination;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  const { page, totalPages } = pagination;

  // Build page number array with ellipsis
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1.5 mt-8">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-9 h-9 text-sm font-medium rounded-lg transition-colors ${
              p === page
                ? "bg-maroon-600 text-white shadow-sm"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">No posts found</h3>
      <p className="text-gray-500 text-sm max-w-sm mx-auto">
        {hasFilters
          ? "Try adjusting your filters or search terms to find what you're looking for."
          : "There are no posts yet. Be the first to list something!"}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse"
        >
          <div className="aspect-[4/3] bg-gray-200" />
          <div className="p-3.5 space-y-2.5">
            <div className="h-5 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-gray-200" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Browse Content ──────────────────────────

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read filter state from URL
  const activeType = searchParams.get("type") || "";
  const activeCategory = searchParams.get("category") || "";
  const activeCondition = searchParams.get("condition") || "";
  const activeSort = searchParams.get("sort") || "recent";
  const activeQ = searchParams.get("q") || "";
  const activePage = parseInt(searchParams.get("page") || "1", 10);

  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(activeQ);

  // Build URL with updated params
  const buildUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      // Reset to page 1 when filters change (unless page itself is being set)
      if (!("page" in updates)) {
        params.delete("page");
      }
      return `${pathname}?${params.toString()}`;
    },
    [searchParams, pathname]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      router.push(buildUrl({ [key]: value }));
    },
    [router, buildUrl]
  );

  // Fetch posts when search params change
  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (activeType) params.set("type", activeType);
      if (activeCategory) params.set("category", activeCategory);
      if (activeCondition) params.set("condition", activeCondition);
      if (activeSort && activeSort !== "recent") params.set("sort", activeSort);
      if (activeQ) params.set("q", activeQ);
      if (activePage > 1) params.set("page", String(activePage));
      params.set("limit", "20");

      try {
        const res = await fetch(`${API_URL}/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load posts");
        const data: PostsResponse = await res.json();
        if (!cancelled) {
          setPosts(data.posts);
          setPagination(data.pagination);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, [activeType, activeCategory, activeCondition, activeSort, activeQ, activePage]);

  // Sync local search input when URL changes externally
  useEffect(() => {
    setSearchInput(activeQ);
  }, [activeQ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter("q", searchInput.trim());
  };

  const hasFilters = !!(activeType || activeCategory || activeCondition || activeQ);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-maroon-800 to-maroon-600 px-4 sm:px-8 py-8 pb-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Browse Posts</h1>
          <p className="text-maroon-200 text-sm mb-5">
            Find what you need from fellow Maroons
          </p>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex bg-white rounded-full shadow-lg overflow-hidden p-1 pl-5 gap-2 items-center max-w-2xl">
            <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search listings..."
              className="flex-1 border-none text-sm text-gray-800 bg-transparent outline-none min-w-0"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setFilter("q", "");
                }}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              className="bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-sm hover:from-maroon-700 hover:to-maroon-800 transition-all"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          {/* Type tabs */}
          <div className="flex items-center gap-0 -mb-px overflow-x-auto">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter("type", tab.value)}
                className={`px-4 sm:px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeType === tab.value
                    ? "border-maroon-600 text-maroon-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* Dropdown filters */}
            <div className="flex items-center gap-2 ml-auto py-2">
              {/* Category (marketplace only or all) */}
              {activeType !== "storage" && (
                <select
                  value={activeCategory}
                  onChange={(e) => setFilter("category", e.target.value)}
                  className={`text-sm border rounded-lg px-2.5 py-1.5 outline-none transition-colors cursor-pointer ${
                    activeCategory
                      ? "border-maroon-300 bg-maroon-50 text-maroon-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}

              {/* Condition (marketplace only) */}
              {activeType !== "storage" && (
                <select
                  value={activeCondition}
                  onChange={(e) => setFilter("condition", e.target.value)}
                  className={`text-sm border rounded-lg px-2.5 py-1.5 outline-none transition-colors cursor-pointer ${
                    activeCondition
                      ? "border-maroon-300 bg-maroon-50 text-maroon-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <option value="">Any Condition</option>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}

              {/* Sort */}
              <select
                value={activeSort}
                onChange={(e) => setFilter("sort", e.target.value === "recent" ? "" : e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 hover:border-gray-300 outline-none transition-colors cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Filters:</span>
            {activeQ && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setFilter("q", "");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors"
              >
                &ldquo;{activeQ}&rdquo;
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {activeType && (
              <button
                onClick={() => setFilter("type", "")}
                className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors"
              >
                {activeType === "marketplace" ? "Marketplace" : "Storage"}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {activeCategory && (
              <button
                onClick={() => setFilter("category", "")}
                className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors"
              >
                {activeCategory}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {activeCondition && (
              <button
                onClick={() => setFilter("condition", "")}
                className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors"
              >
                {conditionLabel(activeCondition)}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              onClick={() => {
                setSearchInput("");
                router.push(pathname);
              }}
              className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6">
        {/* Results count */}
        {!isLoading && pagination && (
          <p className="text-sm text-gray-500 mb-4">
            {pagination.total === 0
              ? "No results"
              : `${pagination.total} ${pagination.total === 1 ? "result" : "results"}`}
          </p>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 font-medium mb-2">Something went wrong</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button
              onClick={() => router.refresh()}
              className="text-sm font-medium text-maroon-600 hover:text-maroon-700 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !error && <LoadingSkeleton />}

        {/* Posts grid */}
        {!isLoading && !error && posts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && posts.length === 0 && (
          <EmptyState hasFilters={hasFilters} />
        )}

        {/* Pagination */}
        {!isLoading && pagination && (
          <Pagination
            pagination={pagination}
            onPageChange={(page) => {
              router.push(buildUrl({ page: page === 1 ? "" : String(page) }));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </main>
    </div>
  );
}

// ── Page Export (wrapped in Suspense for useSearchParams) ──

export default function BrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-gray-50">
          <div className="bg-gradient-to-br from-maroon-800 to-maroon-600 px-4 sm:px-8 py-8 pb-12">
            <div className="max-w-5xl mx-auto">
              <div className="h-8 w-48 bg-white/20 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-white/10 rounded animate-pulse mb-5" />
              <div className="h-11 max-w-2xl bg-white/20 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6">
            <LoadingSkeleton />
          </div>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
