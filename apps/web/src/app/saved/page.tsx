"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ── Types ─────────────────────────────────────────

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
  size: string;
  priceMonthly: number | null;
  isFree: boolean;
}

interface HousingDetails {
  subtype: "sublet" | "passdown";
  monthlyRent: number | null;
  bedrooms: string;
  bathrooms: string;
}

interface PostImage {
  url: string;
}

interface Post {
  id: string;
  title: string;
  type: "marketplace" | "storage" | "housing";
  side: string;
  status: string;
  createdAt: string;
  author: PostAuthor;
  marketplace: MarketplaceDetails | null;
  storage: StorageDetails | null;
  housing: HousingDetails | null;
  images: PostImage[];
  _count?: { savedBy: number };
}

// ── Helpers ───────────────────────────────────────

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
  if (post.type === "housing" && post.housing) {
    if (post.housing.monthlyRent != null) {
      return { text: `$${post.housing.monthlyRent.toFixed(2)}/mo`, isFree: false };
    }
    return { text: "Price TBD", isFree: false };
  }
  return { text: "", isFree: false };
}

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

// ── PostCard with unsave button ───────────────────

function SavedPostCard({
  post,
  onUnsave,
  unsaving,
}: {
  post: Post;
  onUnsave: (id: string) => void;
  unsaving: boolean;
}) {
  const price = formatPrice(post);
  const imageUrl = post.images.length > 0 ? post.images[0].url : null;

  return (
    <div className="group relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Unsave button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onUnsave(post.id);
        }}
        disabled={unsaving}
        title="Remove from saved"
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-red-50 transition-colors disabled:opacity-50"
        aria-label="Remove from saved"
      >
        <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
        </svg>
      </button>

      <Link href={`/posts/${post.id}`} className="block">
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
          <span
            className={`absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full ${
              post.type === "storage"
                ? "bg-amber-100 text-amber-700"
                : post.type === "housing"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-maroon-100 text-maroon-700"
            }`}
          >
            {post.type === "storage" ? "Storage" : post.type === "housing" ? "Housing" : "Marketplace"}
          </span>
        </div>

        <div className="p-3.5">
          {price.text && (
            <span
              className={`inline-block text-sm font-bold mb-1.5 px-2 py-0.5 rounded ${
                price.isFree ? "bg-green-100 text-green-700" : "bg-maroon-100 text-maroon-700"
              }`}
            >
              {price.text}
            </span>
          )}
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-maroon-700 transition-colors">
            {post.title}
          </h3>
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
            </div>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo(post.createdAt)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────

export default function SavedPage() {
  const { user, isLoading: authLoading, accessToken, logout } = useAuth();
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unsavingIds, setUnsavingIds] = useState<Set<string>>(new Set());

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [authLoading, user, router]);

  const fetchSaved = () => {
    if (!accessToken) return;
    fetch(`${API_URL}/api/saved`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data: { data: Post[] }) => setPosts(data.data || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (accessToken) {
      fetchSaved();
    }
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnsave = (postId: string) => {
    // Optimistic removal
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    setUnsavingIds((prev) => new Set(prev).add(postId));

    fetch(`${API_URL}/api/saved/${postId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => {
        if (!r.ok) {
          // Revert on failure
          fetchSaved();
        }
      })
      .catch(() => {
        // Revert on network error
        fetchSaved();
      })
      .finally(() => {
        setUnsavingIds((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
      });
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/browse" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-2 sm:px-3 py-1.5 rounded-md transition-colors">
            Browse
          </Link>
          <Link href="/create" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
            + Post
          </Link>
          <Link href="/saved" className="hidden sm:inline-flex text-sm font-semibold text-maroon-600 border border-maroon-200 bg-maroon-50 px-3 py-1.5 rounded-md transition-colors">
            Saved
          </Link>
          <button
            onClick={logout}
            className="hidden sm:inline-flex text-sm font-semibold text-gray-700 border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            Log Out
          </button>
          <Link
            href={`/profile/${user!.id}`}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold shrink-0"
          >
            {user!.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Saved Posts</h1>
          <p className="text-sm text-gray-500 mt-1">Listings you have saved for later</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="p-3.5 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <SavedPostCard
                key={post.id}
                post={post}
                onUnsave={handleUnsave}
                unsaving={unsavingIds.has(post.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No saved posts yet</p>
            <p className="text-gray-400 text-sm mt-1">Browse listings to save some</p>
            <Link
              href="/browse"
              className="mt-4 inline-block text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-5 py-2 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all"
            >
              Browse listings
            </Link>
          </div>
        )}
      </main>

      <footer className="bg-gray-900 text-gray-500 text-center py-6 text-sm mt-auto">
        &copy; 2026 UChicago E-mart &middot; Made for Maroons, by Maroons
      </footer>
    </>
  );
}
