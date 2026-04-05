"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { NotificationBell } from "@/components/NotificationBell";
import { MessageBell } from "@/components/MessageBell";

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

interface Reviewer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface Review {
  id: string;
  rating: number;
  text: string | null;
  createdAt: string;
  reviewer: Reviewer;
}

interface UserProfile {
  id: string;
  name: string;
  cnetId: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
  createdAt: string;
  stats: {
    averageRating: number | null;
    reviewCount: number;
    transactionCount: number;
    activeListingCount: number;
  };
  activePosts: Post[];
  reviews: {
    data: Review[];
    total: number;
  };
}

// ── Helpers ───────────────────────────────────────

function formatPrice(post: Post): string {
  if (post.type === "marketplace" && post.marketplace) {
    if (post.marketplace.priceType === "free") return "Free";
    if (post.marketplace.priceType === "trade") return "Negotiable";
    if (post.marketplace.priceAmount != null) return `$${post.marketplace.priceAmount.toFixed(2)}`;
    return "Price TBD";
  }
  if (post.type === "storage" && post.storage) {
    if (post.storage.isFree) return "Free";
    if (post.storage.priceMonthly != null) return `$${post.storage.priceMonthly.toFixed(2)}/mo`;
    return "Price TBD";
  }
  if (post.type === "housing" && post.housing) {
    if (post.housing.monthlyRent != null) return `$${post.housing.monthlyRent.toFixed(2)}/mo`;
    return "Price TBD";
  }
  return "";
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Star rating display ───────────────────────────

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const stars = [1, 2, 3, 4, 5];
  const starClass = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <span className="flex items-center gap-0.5">
      {stars.map((s) => (
        <svg
          key={s}
          className={`${starClass} ${s <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── PostCard ──────────────────────────────────────

function PostCard({ post }: { post: Post }) {
  const price = formatPrice(post);
  const imageUrl = post.images.length > 0 ? post.images[0].url : null;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
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
        {price && (
          <span className="inline-block text-sm font-bold mb-1.5 px-2 py-0.5 rounded bg-maroon-100 text-maroon-700">
            {price}
          </span>
        )}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-maroon-700 transition-colors">
          {post.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1.5">{timeAgo(post.createdAt)}</p>
      </div>
    </Link>
  );
}

// ── ReviewCard ────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const initials = review.reviewer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {review.reviewer.avatarUrl ? (
            <img
              src={review.reviewer.avatarUrl}
              alt={review.reviewer.name}
              className="w-9 h-9 rounded-full object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-maroon-400 to-maroon-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900 truncate">{review.reviewer.name}</p>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo(review.createdAt)}</span>
          </div>
          <StarDisplay rating={review.rating} />
          {review.text && (
            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{review.text}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, accessToken, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<"listings" | "reviews">("listings");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  // Fetch profile
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setNotFound(false);

    const headers: HeadersInit = {};
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    fetch(`${API_URL}/api/users/${id}`, { headers })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data: UserProfile | null) => {
        if (data) {
          setProfile(data);
          setReviews(data.reviews.data);
          setReviewTotal(data.reviews.total);
          setReviewPage(1);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id, accessToken]);

  const loadMoreReviews = () => {
    if (!id) return;
    const nextPage = reviewPage + 1;
    setLoadingMoreReviews(true);

    fetch(`${API_URL}/api/users/${id}/reviews?page=${nextPage}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { data: Review[]; total: number } | null) => {
        if (data) {
          setReviews((prev) => [...prev, ...data.data]);
          setReviewPage(nextPage);
          setReviewTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMoreReviews(false));
  };

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : "?";

  return (
    <>
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser ? (
            <>
              <Link href="/create" className="flex items-center gap-1.5 bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-sm hover:from-maroon-700 hover:to-maroon-800 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Post
              </Link>
              <NotificationBell />
              <MessageBell />
              <div className="relative">
                {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
                <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-full overflow-hidden shrink-0 relative z-50">
                  {currentUser.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold">
                      {currentUser.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                    <Link href={`/profile/${currentUser.id}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      Profile
                    </Link>
                    <Link href="/saved" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                      Saved
                    </Link>
                    <Link href="/history" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      History
                    </Link>
                    <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                      Notifications
                    </Link>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" /></svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth" className="hidden sm:inline-flex text-sm font-semibold text-gray-700 border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors">
                Log In
              </Link>
              <Link href="/auth" className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-200 rounded w-48 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
              </div>
            </div>
          </div>
        ) : notFound ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">User not found.</p>
            <Link href="/browse" className="mt-4 inline-block text-sm text-maroon-600 hover:underline">
              Back to Browse
            </Link>
          </div>
        ) : profile ? (
          <>
            {/* Profile header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                {/* Avatar */}
                <div className="shrink-0">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={profile.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-2xl font-bold">
                      {initials}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">{profile.name}</h1>
                    {profile.isVerified && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Phone Verified
                      </span>
                    )}
                    {isOwnProfile && (
                      <Link
                        href="/settings"
                        className="ml-auto text-xs font-medium text-gray-500 border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors"
                      >
                        Edit Profile
                      </Link>
                    )}
                  </div>

                  {profile.cnetId && (
                    <p className="text-sm text-gray-500 mt-1">@{profile.cnetId}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Member since {formatDate(profile.createdAt)}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100">
                {/* Rating */}
                <div className="flex flex-col items-center gap-1">
                  {profile.stats.averageRating != null ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <StarDisplay rating={profile.stats.averageRating} size="md" />
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {profile.stats.averageRating.toFixed(1)}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-gray-400">—</p>
                  )}
                  <p className="text-xs text-gray-400">Avg Rating</p>
                </div>

                {/* Review count */}
                <div className="flex flex-col items-center gap-1">
                  <p className="text-lg font-bold text-gray-900">{profile.stats.reviewCount}</p>
                  <p className="text-xs text-gray-400">Reviews</p>
                </div>

                {/* Transactions */}
                <div className="flex flex-col items-center gap-1">
                  <p className="text-lg font-bold text-gray-900">{profile.stats.transactionCount}</p>
                  <p className="text-xs text-gray-400">Transactions</p>
                </div>

                {/* Active listings */}
                <div className="flex flex-col items-center gap-1">
                  <p className="text-lg font-bold text-gray-900">{profile.stats.activeListingCount}</p>
                  <p className="text-xs text-gray-400">Active Listings</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                onClick={() => setActiveTab("listings")}
                className={`px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
                  activeTab === "listings"
                    ? "text-maroon-700 border-maroon-600"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                Listings
                {profile.activePosts.length > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                    {profile.activePosts.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("reviews")}
                className={`px-5 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
                  activeTab === "reviews"
                    ? "text-maroon-700 border-maroon-600"
                    : "text-gray-500 border-transparent hover:text-gray-700"
                }`}
              >
                Reviews
                {reviewTotal > 0 && (
                  <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                    {reviewTotal}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            {activeTab === "listings" ? (
              profile.activePosts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profile.activePosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-gray-400 text-sm">
                    {isOwnProfile ? "You have no active listings." : "No active listings."}
                  </p>
                  {isOwnProfile && (
                    <Link
                      href="/create"
                      className="mt-3 inline-block text-sm font-medium text-maroon-600 hover:underline"
                    >
                      + Create a listing
                    </Link>
                  )}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-4">
                {reviews.length > 0 ? (
                  <>
                    {reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                    {reviews.length < reviewTotal && (
                      <button
                        onClick={loadMoreReviews}
                        disabled={loadingMoreReviews}
                        className="mt-2 self-center text-sm font-medium text-maroon-600 border border-maroon-200 px-5 py-2 rounded-full hover:bg-maroon-50 disabled:opacity-50 transition-colors"
                      >
                        {loadingMoreReviews ? "Loading..." : "Load more"}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm">No reviews yet.</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </main>

      <footer className="bg-gray-900 text-gray-500 text-center py-6 text-sm mt-auto">
        &copy; 2026 UChicago E-mart &middot; Made for Maroons, by Maroons
      </footer>
    </>
  );
}
