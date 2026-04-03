"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import {
  HOUSING_AMENITIES,
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
  LEASE_DURATION_OPTIONS,
} from "@uchicago-marketplace/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ---------- Types ----------

interface PostAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface PostImage {
  id: string;
  url: string;
  order: number;
}

interface MarketplaceDetails {
  priceType: string;
  priceAmount: number | null;
  condition: string | null;
  category: string | null;
  tradeDescription: string | null;
  tags: string[];
}

interface StorageDetails {
  startDate: string;
  endDate: string;
  size: string;
  locationType: string;
  neighborhood: string | null;
  priceMonthly: number | null;
  isFree: boolean;
  restrictions: string | null;
}

interface HousingDetails {
  subtype: "sublet" | "passdown";
  monthlyRent: number | null;
  bedrooms: string;
  bathrooms: string;
  neighborhood: string | null;
  amenities: string[];
  roommates: "solo" | "shared";
  roommateCount: number | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  leaseStartDate: string | null;
  leaseDurationMonths: number | null;
}

interface Post {
  id: string;
  title: string;
  description: string | null;
  type: string;
  side: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  marketplace: MarketplaceDetails | null;
  storage: StorageDetails | null;
  housing: HousingDetails | null;
  images: PostImage[];
  isSaved?: boolean;
  _count: { savedBy: number };
}

interface UserSearchResult {
  id: string;
  name: string;
  cnetId: string;
  avatarUrl: string | null;
}

interface ReviewEligibility {
  eligible: boolean;
  revieweeId?: string;
  revieweeName?: string;
  alreadyReviewed: boolean;
}

// ---------- Helpers ----------

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatPrice(post: Post): string {
  if (post.marketplace) {
    if (post.marketplace.priceType === "free") return "Free";
    if (post.marketplace.priceType === "trade") return "Trade";
    if (post.marketplace.priceAmount != null) {
      return `$${post.marketplace.priceAmount.toFixed(2)}`;
    }
    return "Contact for price";
  }
  if (post.storage) {
    if (post.storage.isFree) return "Free";
    if (post.storage.priceMonthly != null) {
      return `$${post.storage.priceMonthly.toFixed(2)}/mo`;
    }
    return "Contact for price";
  }
  if (post.housing) {
    if (post.housing.monthlyRent != null) {
      return `$${post.housing.monthlyRent.toFixed(2)}/mo`;
    }
    return "Contact for price";
  }
  return "";
}

function typeBadgeClasses(type: string): string {
  if (type === "storage") return "bg-amber-100 text-amber-700";
  if (type === "housing") return "bg-indigo-100 text-indigo-700";
  return "bg-maroon-100 text-maroon-700";
}

function typeLabel(type: string): string {
  if (type === "storage") return "Storage";
  if (type === "housing") return "Housing";
  return "Marketplace";
}

function sideLabel(side: string): string {
  if (side === "buy" || side === "need_storage" || side === "looking") return "Looking for";
  return "Offering";
}

function conditionLabel(condition: string | null): string {
  if (!condition) return "";
  const map: Record<string, string> = {
    new_item: "New",
    like_new: "Like New",
    good: "Good",
    fair: "Fair",
    for_parts: "For Parts",
  };
  return map[condition] || condition;
}

// ---------- Sub-components ----------

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Image skeleton */}
          <div className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />

          {/* Details skeleton */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-8 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-px bg-gray-200" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
            <div className="h-px bg-gray-200" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl font-black text-gray-200 mb-4">404</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Post not found</h1>
        <p className="text-gray-500 mb-6">
          This post may have been removed or the link is incorrect.
        </p>
        <Link
          href="/browse"
          className="inline-block bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-6 py-2.5 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all"
        >
          Back to Browse
        </Link>
      </div>
    </div>
  );
}

function ImageGallery({ images }: { images: PostImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200">
        <div className="text-center text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-3 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
            />
          </svg>
          <p className="text-sm font-medium">No images</p>
        </div>
      </div>
    );
  }

  const sorted = [...images].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
        <img
          src={sorted[activeIndex].url}
          alt={`Image ${activeIndex + 1}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Thumbnails */}
      {sorted.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sorted.map((img, idx) => (
            <button
              key={img.id}
              onClick={() => setActiveIndex(idx)}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                idx === activeIndex
                  ? "border-maroon-600 ring-1 ring-maroon-600"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <img
                src={img.url}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  onConfirm,
  onCancel,
  isDeleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Delete post?</h3>
        <p className="text-sm text-gray-500 mb-6">
          This action cannot be undone. The post will be permanently removed.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Detail sections ----------

function MarketplaceDetailsSection({ details }: { details: MarketplaceDetails }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
        Listing Details
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {details.category && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Category
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{details.category}</dd>
          </div>
        )}
        {details.condition && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Condition
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {conditionLabel(details.condition)}
            </dd>
          </div>
        )}
        {details.priceType && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Price Type
            </dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {details.priceType.toLowerCase()}
            </dd>
          </div>
        )}
      </div>

      {details.tradeDescription && (
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Trade Description
          </dt>
          <dd className="mt-1 text-sm text-gray-900">{details.tradeDescription}</dd>
        </div>
      )}

      {details.tags && details.tags.length > 0 && (
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Tags
          </dt>
          <dd className="flex flex-wrap gap-2">
            {details.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block bg-gray-100 text-gray-700 text-xs font-medium px-2.5 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </dd>
        </div>
      )}
    </div>
  );
}

function StorageDetailsSection({ details }: { details: StorageDetails }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
        Storage Details
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {details.startDate && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Start Date
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(details.startDate)}
            </dd>
          </div>
        )}
        {details.endDate && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              End Date
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(details.endDate)}
            </dd>
          </div>
        )}
        {details.size && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Size
            </dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {details.size.toLowerCase().replace(/_/g, " ")}
            </dd>
          </div>
        )}
        {details.locationType && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Location Type
            </dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {details.locationType.toLowerCase().replace(/_/g, " ")}
            </dd>
          </div>
        )}
        {details.neighborhood && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Neighborhood
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{details.neighborhood}</dd>
          </div>
        )}
      </div>

      {details.restrictions && (
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Restrictions
          </dt>
          <dd className="mt-1 text-sm text-gray-900">{details.restrictions}</dd>
        </div>
      )}
    </div>
  );
}

function HousingDetailsSection({ details }: { details: HousingDetails }) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
        Housing Details
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Subtype
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {details.subtype === "sublet" ? "Sublet" : "Passdown"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Bedrooms
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {BEDROOM_OPTIONS.find((b) => b.value === details.bedrooms)?.label || details.bedrooms}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Bathrooms
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {BATHROOM_OPTIONS.find((b) => b.value === details.bathrooms)?.label || details.bathrooms}
          </dd>
        </div>
        {details.monthlyRent != null && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Rent
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              ${details.monthlyRent.toFixed(2)}/mo
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Roommates
          </dt>
          <dd className="mt-1 text-sm text-gray-900">
            {details.roommates === "solo"
              ? "Solo"
              : `Shared${details.roommateCount ? ` (${details.roommateCount})` : ""}`}
          </dd>
        </div>
        {details.neighborhood && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Location
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{details.neighborhood}</dd>
          </div>
        )}
        {/* Date info: sublet vs passdown */}
        {details.subtype === "sublet" && details.moveInDate && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Move-in
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(details.moveInDate)}
            </dd>
          </div>
        )}
        {details.subtype === "sublet" && details.moveOutDate && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Move-out
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(details.moveOutDate)}
            </dd>
          </div>
        )}
        {details.subtype === "passdown" && details.leaseStartDate && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Lease Start
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDate(details.leaseStartDate)}
            </dd>
          </div>
        )}
        {details.subtype === "passdown" && details.leaseDurationMonths && (
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Duration
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {LEASE_DURATION_OPTIONS.find((d) => d.value === details.leaseDurationMonths)?.label || `${details.leaseDurationMonths} months`}
            </dd>
          </div>
        )}
      </div>

      {details.amenities && details.amenities.length > 0 && (
        <div>
          <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Amenities
          </dt>
          <dd className="flex flex-wrap gap-2">
            {details.amenities.map((amenity) => (
              <span
                key={amenity}
                className="inline-block bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full"
              >
                {HOUSING_AMENITIES.find((a) => a.value === amenity)?.label || amenity}
              </span>
            ))}
          </dd>
        </div>
      )}
    </div>
  );
}

// ---------- Main page component ----------

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Save/unsave
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Mark as sold/completed
  const [showMarkSold, setShowMarkSold] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<{ id: string; name: string; cnetId: string } | null>(null);
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);

  // Review
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState<ReviewEligibility | null>(null);

  const postId = params.id;

  const fetchPost = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    try {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      const res = await fetch(`${API_URL}/api/posts/${postId}`, { headers });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setPost(data);
      setIsSaved(data.isSaved ?? false);
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [postId, accessToken]);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId, fetchPost]);

  // Debounced user search for mark-sold modal
  useEffect(() => {
    if (!showMarkSold) return;
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch {
        // ignore search errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showMarkSold, accessToken]);

  // Fetch review eligibility when post is sold/completed
  useEffect(() => {
    if (!post || !accessToken || !user) return;
    if (post.status !== "sold" && post.status !== "completed") return;
    if (post.author.id === user.id) return; // owner doesn't review themselves
    const fetchEligibility = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/reviews/eligibility?postId=${postId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setReviewEligibility(data);
        }
      } catch {
        // ignore eligibility errors
      }
    };
    fetchEligibility();
  }, [post, postId, accessToken, user]);

  const handleDelete = async () => {
    if (!accessToken) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setDeleteError(data?.message || "Failed to delete post");
        return;
      }
      router.push("/browse");
    } catch {
      setDeleteError("Failed to delete post. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSave = async () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (isSaving) return;
    const prevSaved = isSaved;
    setIsSaved(!prevSaved);
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/saved/${postId}`, {
        method: prevSaved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        setIsSaved(prevSaved); // rollback
      }
    } catch {
      setIsSaved(prevSaved); // rollback
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkSoldOpen = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedBuyer(null);
    setShowMarkSold(true);
  };

  const handleMarkSoldConfirm = async () => {
    if (!selectedBuyer || !accessToken) return;
    setIsSubmittingTransaction(true);
    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ postId, buyerId: selectedBuyer.id }),
      });
      if (res.ok) {
        setShowMarkSold(false);
        fetchPost();
      }
    } catch {
      // ignore, keep modal open
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewEligibility?.revieweeId || reviewRating === 0 || !accessToken) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch(`${API_URL}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId,
          revieweeId: reviewEligibility.revieweeId,
          rating: reviewRating,
          text: reviewText.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowReviewForm(false);
        setReviewEligibility({ ...reviewEligibility, eligible: false, alreadyReviewed: true });
      }
    } catch {
      // ignore, keep form open
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (notFound || !post) return <NotFound />;

  const isOwner = user?.id === post.author.id;
  const priceDisplay = formatPrice(post);
  const isFree =
    (post.marketplace?.priceType === "free") ||
    (post.storage?.isFree === true);
  const isHousing = post.type === "housing";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 min-w-0">
          <Link
            href="/browse"
            className="hover:text-maroon-600 transition-colors shrink-0"
          >
            Browse
          </Link>
          <span className="text-gray-300 shrink-0">/</span>
          <span className="text-gray-900 font-medium truncate">
            {post.title}
          </span>
        </nav>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Image gallery */}
          <ImageGallery images={post.images} />

          {/* Right: Details */}
          <div className="space-y-6">
            {/* Badges + title + price */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${typeBadgeClasses(post.type)}`}
                >
                  {typeLabel(post.type)}
                </span>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {sideLabel(post.side)}
                </span>
                {post.marketplace?.condition && (
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                    {conditionLabel(post.marketplace.condition)}
                  </span>
                )}
                {post.housing && (
                  <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    {post.housing.subtype === "sublet" ? "Sublet" : "Passdown"}
                  </span>
                )}
                {(post.status === "sold" || post.status === "completed") && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide bg-gray-200 text-gray-600">
                    {post.status === "sold" ? "Sold" : "Completed"}
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3">
                <h1 className="text-2xl font-extrabold text-gray-900 mb-2 flex-1">
                  {post.title}
                </h1>
                {/* Save button */}
                {!isOwner && (
                  <button
                    onClick={handleToggleSave}
                    disabled={isSaving}
                    aria-label={isSaved ? "Unsave post" : "Save post"}
                    className={`mt-0.5 p-2 rounded-full transition-colors ${
                      isSaved
                        ? "text-maroon-600 bg-maroon-50 hover:bg-maroon-100"
                        : "text-gray-400 bg-gray-100 hover:bg-gray-200"
                    } disabled:opacity-50`}
                  >
                    <svg
                      className="w-5 h-5"
                      fill={isSaved ? "currentColor" : "none"}
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                      />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-baseline gap-3">
                <span
                  className={`text-3xl font-black ${
                    isFree ? "text-green-600" : "text-gray-900"
                  }`}
                >
                  {priceDisplay}
                </span>
                {((post.storage && !post.storage.isFree) || (isHousing && post.housing?.monthlyRent)) && (
                  <span className="text-sm text-gray-500">per month</span>
                )}
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Author */}
            <Link href={`/profile/${post.author.id}`} className="flex items-center gap-3 hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors">
              {post.author.avatarUrl ? (
                <img
                  src={post.author.avatarUrl}
                  alt={post.author.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-sm font-bold">
                  {post.author.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-900">
                    {post.author.name}
                  </span>
                  {post.author.isVerified && (
                    <svg
                      className="w-4 h-4 text-maroon-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Posted {formatDate(post.createdAt)}
                </p>
              </div>
            </Link>

            <hr className="border-gray-200" />

            {/* Description */}
            {post.description && (
              <>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {post.description}
                  </p>
                </div>
                <hr className="border-gray-200" />
              </>
            )}

            {/* Type-specific details */}
            {post.marketplace && (
              <>
                <MarketplaceDetailsSection details={post.marketplace} />
                <hr className="border-gray-200" />
              </>
            )}

            {post.storage && (
              <>
                <StorageDetailsSection details={post.storage} />
                <hr className="border-gray-200" />
              </>
            )}

            {post.housing && (
              <>
                <HousingDetailsSection details={post.housing} />
                <hr className="border-gray-200" />
              </>
            )}

            {/* Save count */}
            {post._count.savedBy > 0 && (
              <p className="text-xs text-gray-500">
                {post._count.savedBy}{" "}
                {post._count.savedBy === 1 ? "person" : "people"} saved this
              </p>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                disabled
                className="flex-1 min-w-[120px] sm:min-w-[140px] bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold py-3 rounded-lg shadow-md opacity-50 cursor-not-allowed"
              >
                Message Seller
              </button>
              {!isOwner && (
                <button
                  onClick={handleToggleSave}
                  disabled={isSaving}
                  className={`flex-1 min-w-[120px] sm:min-w-[140px] border text-sm font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 ${
                    isSaved
                      ? "border-maroon-600 text-maroon-700 bg-maroon-50 hover:bg-maroon-100"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {isSaved ? "Saved" : "Save"}
                </button>
              )}
            </div>

            {/* Owner actions */}
            {isOwner && (
              <div className="flex flex-col gap-3 pt-2">
                {post.status === "active" && (
                  <button
                    onClick={handleMarkSoldOpen}
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    {post.type === "marketplace" ? "Mark as Sold" : "Mark as Completed"}
                  </button>
                )}
                <div className="flex gap-3">
                  <Link
                    href={`/posts/${post.id}/edit`}
                    className="flex-1 text-center border border-maroon-600 text-maroon-700 text-sm font-semibold py-2.5 rounded-lg hover:bg-maroon-50 transition-colors"
                  >
                    Edit Post
                  </Link>
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="flex-1 text-center border border-red-300 text-red-600 text-sm font-semibold py-2.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete Post
                  </button>
                </div>
              </div>
            )}

            {/* Review section (non-owners, post sold/completed) */}
            {!isOwner && user && reviewEligibility && (
              <div className="pt-1">
                {reviewEligibility.alreadyReviewed ? (
                  <p className="text-sm text-gray-500 italic">
                    You have already reviewed this transaction.
                  </p>
                ) : reviewEligibility.eligible ? (
                  <button
                    onClick={() => setShowReviewForm(true)}
                    className="w-full border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 text-sm font-semibold py-2.5 rounded-lg transition-colors"
                  >
                    Leave a Review for {reviewEligibility.revieweeName}
                  </button>
                ) : null}
              </div>
            )}

            {deleteError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {deleteError}
              </p>
            )}

            {/* Back link */}
            <Link
              href="/browse"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-maroon-600 transition-colors mt-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                />
              </svg>
              Back to Browse
            </Link>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <ConfirmDeleteDialog
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteDialog(false)}
          isDeleting={isDeleting}
        />
      )}

      {/* Mark as Sold/Completed modal */}
      {showMarkSold && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowMarkSold(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">
              {post.type === "marketplace" ? "Mark as Sold" : "Mark as Completed"}
            </h3>
            <p className="text-sm text-gray-500">
              Search for the person you transacted with.
            </p>

            {/* User search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedBuyer(null);
              }}
              placeholder="Search by name or CNetID..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            {/* Search results */}
            {searchResults.length > 0 && !selectedBuyer && (
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {searchResults.map((u) => (
                  <li key={u.id}>
                    <button
                      onClick={() => {
                        setSelectedBuyer({ id: u.id, name: u.name, cnetId: u.cnetId });
                        setSearchResults([]);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">@{u.cnetId}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Selected user */}
            {selectedBuyer && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-green-800">{selectedBuyer.name}</div>
                  <div className="text-xs text-green-600">@{selectedBuyer.cnetId}</div>
                </div>
                <button
                  onClick={() => setSelectedBuyer(null)}
                  className="text-green-600 hover:text-green-800 text-xs font-medium"
                >
                  Change
                </button>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowMarkSold(false)}
                disabled={isSubmittingTransaction}
                className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkSoldConfirm}
                disabled={!selectedBuyer || isSubmittingTransaction}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSubmittingTransaction ? "Confirming..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave a Review modal */}
      {showReviewForm && reviewEligibility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowReviewForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900">
              Leave a Review for {reviewEligibility.revieweeName}
            </h3>

            {/* Star rating */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Rating</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                    className="focus:outline-none"
                  >
                    <svg
                      className={`w-8 h-8 transition-colors ${
                        star <= reviewRating ? "text-amber-400" : "text-gray-300"
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292Z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Review text */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Review (optional)
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => {
                  if (e.target.value.length <= 500) setReviewText(e.target.value);
                }}
                placeholder="Share your experience..."
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
              <p className="text-xs text-gray-400 text-right mt-1">
                {reviewText.length}/500
              </p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowReviewForm(false)}
                disabled={isSubmittingReview}
                className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewRating === 0 || isSubmittingReview}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {isSubmittingReview ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
