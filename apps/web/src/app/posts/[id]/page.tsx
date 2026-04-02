"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

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
  images: PostImage[];
  _count: { savedBy: number };
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
  return "";
}

function typeBadgeClasses(type: string): string {
  if (type === "storage") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-maroon-100 text-maroon-700";
}

function typeLabel(type: string): string {
  if (type === "storage") return "Storage";
  return "Marketplace";
}

function sideLabel(side: string): string {
  if (side === "buy" || side === "need_storage") return "Looking for";
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
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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

  const postId = params.id;

  const fetchPost = useCallback(async () => {
    setIsLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`);
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
    } catch {
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId, fetchPost]);

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

  if (isLoading) return <LoadingSkeleton />;
  if (notFound || !post) return <NotFound />;

  const isOwner = user?.id === post.author.id;
  const priceDisplay = formatPrice(post);
  const isFree =
    (post.marketplace?.priceType === "free") ||
    (post.storage?.isFree === true);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/browse"
            className="hover:text-maroon-600 transition-colors"
          >
            Browse
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-medium truncate max-w-xs">
            {post.title}
          </span>
        </nav>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Left: Image gallery */}
          <ImageGallery images={post.images} />

          {/* Right: Details */}
          <div className="space-y-6">
            {/* Badges + title + price */}
            <div>
              <div className="flex items-center gap-2 mb-3">
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
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
                {post.title}
              </h1>
              <div className="flex items-baseline gap-3">
                <span
                  className={`text-3xl font-black ${
                    isFree ? "text-green-600" : "text-gray-900"
                  }`}
                >
                  {priceDisplay}
                </span>
                {post.storage && !post.storage.isFree && (
                  <span className="text-sm text-gray-500">per month</span>
                )}
              </div>
            </div>

            <hr className="border-gray-200" />

            {/* Author */}
            <div className="flex items-center gap-3">
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
            </div>

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
                className="flex-1 min-w-[140px] bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold py-3 rounded-lg shadow-md opacity-50 cursor-not-allowed"
              >
                Message Seller
              </button>
              <button
                disabled
                className="flex-1 min-w-[140px] border border-gray-300 text-gray-700 text-sm font-semibold py-3 rounded-lg hover:bg-gray-50 transition-colors opacity-50 cursor-not-allowed"
              >
                Save
              </button>
            </div>

            {/* Owner actions */}
            {isOwner && (
              <div className="flex gap-3 pt-2">
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
    </div>
  );
}
