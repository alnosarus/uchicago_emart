"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ---------- Constants ----------

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
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For Parts" },
];

const SIZES: { value: string; label: string }[] = [
  { value: "boxes", label: "A few boxes" },
  { value: "half_room", label: "Half a room" },
  { value: "full_room", label: "Full room" },
];

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
  author: PostAuthor;
  marketplace: MarketplaceDetails | null;
  storage: StorageDetails | null;
  images: PostImage[];
}

// ---------- Helpers ----------

/**
 * Prisma returns "new_item" for the New condition enum value.
 * The API expects "new" when sending updates. Map it back.
 */
function normalizeConditionForApi(condition: string | null): string | null {
  if (condition === "new_item") return "new";
  return condition;
}

/**
 * Prisma returns "new_item" but our form <select> uses "new".
 * Normalise the value coming from the API so the <select> picks the right option.
 */
function normalizeConditionForForm(condition: string | null): string {
  if (condition === "new_item") return "new";
  return condition ?? "";
}

function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // The API may return an ISO string; we just need YYYY-MM-DD for <input type="date">
  return dateStr.slice(0, 10);
}

// ---------- Form state interfaces ----------

interface MarketplaceFormState {
  priceType: string;
  priceAmount: string;
  condition: string;
  category: string;
  tags: string;
}

interface StorageFormState {
  startDate: string;
  endDate: string;
  size: string;
  locationType: string;
  neighborhood: string;
  priceMonthly: string;
  isFree: boolean;
  restrictions: string;
}

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-8 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-4 w-14 bg-gray-200 rounded animate-pulse" />
      </nav>
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 space-y-6">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="space-y-4">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-24 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-px bg-gray-200" />
          <div className="space-y-4">
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="h-11 w-full bg-gray-200 rounded-full animate-pulse" />
        </div>
      </main>
    </>
  );
}

// ---------- Main page component ----------

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, accessToken, isLoading: authLoading } = useAuth();

  const postId = params.id;

  // Loading / error state
  const [isLoadingPost, setIsLoadingPost] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Common fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Type-specific form state
  const [marketplace, setMarketplace] = useState<MarketplaceFormState>({
    priceType: "fixed",
    priceAmount: "",
    condition: "",
    category: "",
    tags: "",
  });

  const [storage, setStorage] = useState<StorageFormState>({
    startDate: "",
    endDate: "",
    size: "",
    locationType: "on_campus",
    neighborhood: "",
    priceMonthly: "",
    isFree: false,
    restrictions: "",
  });

  // ---------- Fetch post ----------

  const fetchPost = useCallback(async () => {
    setIsLoadingPost(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`);
      if (!res.ok) {
        setError("Failed to load post.");
        return;
      }
      const data: Post = await res.json();
      setPost(data);

      // Pre-fill common fields
      setTitle(data.title);
      setDescription(data.description ?? "");

      // Pre-fill type-specific fields
      if (data.marketplace) {
        const m = data.marketplace;
        setMarketplace({
          priceType: m.priceType,
          priceAmount: m.priceAmount != null ? String(m.priceAmount) : "",
          condition: normalizeConditionForForm(m.condition),
          category: m.category ?? "",
          tags: (m.tags ?? []).join(", "),
        });
      }
      if (data.storage) {
        const s = data.storage;
        setStorage({
          startDate: formatDateForInput(s.startDate),
          endDate: formatDateForInput(s.endDate),
          size: s.size,
          locationType: s.locationType,
          neighborhood: s.neighborhood ?? "",
          priceMonthly: s.priceMonthly != null ? String(s.priceMonthly) : "",
          isFree: s.isFree,
          restrictions: s.restrictions ?? "",
        });
      }
    } catch {
      setError("Failed to load post.");
    } finally {
      setIsLoadingPost(false);
    }
  }, [postId]);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId, fetchPost]);

  // ---------- Redirect non-owners ----------

  useEffect(() => {
    if (!authLoading && !isLoadingPost && post) {
      if (!user || user.id !== post.author.id) {
        router.replace(`/posts/${postId}`);
      }
    }
  }, [authLoading, isLoadingPost, post, user, router, postId]);

  // ---------- Build changed-fields payload ----------

  function buildPayload(): Record<string, unknown> {
    if (!post) return {};

    const payload: Record<string, unknown> = {};

    // Common fields -- only include if changed
    if (title.trim() !== post.title) {
      payload.title = title.trim();
    }
    const newDesc = description.trim() || null;
    if (newDesc !== (post.description ?? null)) {
      payload.description = newDesc;
    }

    // Marketplace fields
    if (post.marketplace) {
      const m = post.marketplace;
      const mp: Record<string, unknown> = {};

      if (marketplace.priceType !== m.priceType) {
        mp.priceType = marketplace.priceType;
      }
      const newAmount =
        marketplace.priceType === "fixed"
          ? parseFloat(marketplace.priceAmount) || 0
          : null;
      if (newAmount !== m.priceAmount) {
        mp.priceAmount = newAmount;
      }
      const newCondition = normalizeConditionForApi(marketplace.condition || null);
      const origCondition = normalizeConditionForApi(m.condition);
      if (newCondition !== origCondition) {
        mp.condition = newCondition;
      }
      if ((marketplace.category || null) !== (m.category ?? null)) {
        mp.category = marketplace.category || null;
      }
      const newTags = marketplace.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const origTags = m.tags ?? [];
      if (JSON.stringify(newTags) !== JSON.stringify(origTags)) {
        mp.tags = newTags;
      }

      if (Object.keys(mp).length > 0) {
        payload.marketplace = mp;
      }
    }

    // Storage fields
    if (post.storage) {
      const s = post.storage;
      const sp: Record<string, unknown> = {};

      if (storage.startDate !== formatDateForInput(s.startDate)) {
        sp.startDate = storage.startDate;
      }
      if (storage.endDate !== formatDateForInput(s.endDate)) {
        sp.endDate = storage.endDate;
      }
      if (storage.size !== s.size) {
        sp.size = storage.size;
      }
      if (storage.locationType !== s.locationType) {
        sp.locationType = storage.locationType;
      }
      if ((storage.neighborhood.trim() || null) !== (s.neighborhood ?? null)) {
        sp.neighborhood = storage.neighborhood.trim() || null;
      }
      if (storage.isFree !== s.isFree) {
        sp.isFree = storage.isFree;
      }
      const newPriceMonthly = storage.isFree
        ? null
        : parseFloat(storage.priceMonthly) || null;
      if (newPriceMonthly !== s.priceMonthly) {
        sp.priceMonthly = newPriceMonthly;
      }
      if ((storage.restrictions.trim() || null) !== (s.restrictions ?? null)) {
        sp.restrictions = storage.restrictions.trim() || null;
      }

      if (Object.keys(sp).length > 0) {
        payload.storage = sp;
      }
    }

    return payload;
  }

  // ---------- Submit ----------

  async function handleSubmit() {
    if (!accessToken) return;
    setSubmitting(true);
    setError("");

    const payload = buildPayload();

    // Nothing changed
    if (Object.keys(payload).length === 0) {
      router.push(`/posts/${postId}`);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Request failed (${res.status})`);
      }
      router.push(`/posts/${postId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Shared CSS classes ----------

  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all";
  const selectClass =
    "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 bg-white outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all";

  // ---------- Render guards ----------

  if (authLoading || isLoadingPost) {
    return <LoadingSkeleton />;
  }

  if (!post || !user || user.id !== post.author.id) {
    // Redirect is triggered by the useEffect above; render nothing while it happens
    return null;
  }

  // ---------- Type / side labels ----------

  const typeLabel = post.type === "storage" ? "Storage" : "Marketplace";
  const typeBadgeClasses =
    post.type === "storage"
      ? "bg-amber-100 text-amber-700"
      : "bg-maroon-100 text-maroon-700";

  function sideLabel(side: string): string {
    const map: Record<string, string> = {
      sell: "Selling",
      buy: "Buying",
      has_space: "Has Space",
      need_storage: "Needs Storage",
    };
    return map[side] || side;
  }

  // ---------- Marketplace form ----------

  function renderMarketplaceFields() {
    return (
      <div className="space-y-5">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Listing Details
        </h3>

        {/* Category */}
        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <select
            id="category"
            value={marketplace.category}
            onChange={(e) =>
              setMarketplace((p) => ({ ...p, category: e.target.value }))
            }
            className={selectClass}
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Condition */}
        <div>
          <label htmlFor="condition" className={labelClass}>
            Condition
          </label>
          <select
            id="condition"
            value={marketplace.condition}
            onChange={(e) =>
              setMarketplace((p) => ({ ...p, condition: e.target.value }))
            }
            className={selectClass}
          >
            <option value="">Select condition</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Price type */}
        <div>
          <label className={labelClass}>Pricing</label>
          <div className="grid grid-cols-3 gap-3">
            {(["fixed", "free", "trade"] as const).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() =>
                  setMarketplace((p) => ({ ...p, priceType: pt }))
                }
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all capitalize ${
                  marketplace.priceType === pt
                    ? "border-maroon-600 bg-maroon-50 text-maroon-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {pt === "fixed" ? "Fixed Price" : pt === "free" ? "Free" : "Trade"}
              </button>
            ))}
          </div>
        </div>

        {/* Price amount (only if fixed) */}
        {marketplace.priceType === "fixed" && (
          <div>
            <label htmlFor="priceAmount" className={labelClass}>
              Price ($)
            </label>
            <input
              id="priceAmount"
              type="number"
              min="0"
              step="0.01"
              value={marketplace.priceAmount}
              onChange={(e) =>
                setMarketplace((p) => ({ ...p, priceAmount: e.target.value }))
              }
              placeholder="0.00"
              className={inputClass}
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label htmlFor="tags" className={labelClass}>
            Tags
          </label>
          <input
            id="tags"
            type="text"
            value={marketplace.tags}
            onChange={(e) =>
              setMarketplace((p) => ({ ...p, tags: e.target.value }))
            }
            placeholder="e.g. chemistry, textbook, science (comma-separated)"
            className={inputClass}
          />
          <p className="text-xs text-gray-400 mt-1">Separate tags with commas</p>
        </div>
      </div>
    );
  }

  // ---------- Storage form ----------

  function renderStorageFields() {
    return (
      <div className="space-y-5">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Storage Details
        </h3>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className={labelClass}>
              Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={storage.startDate}
              onChange={(e) =>
                setStorage((p) => ({ ...p, startDate: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="endDate" className={labelClass}>
              End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={storage.endDate}
              onChange={(e) =>
                setStorage((p) => ({ ...p, endDate: e.target.value }))
              }
              className={inputClass}
            />
          </div>
        </div>

        {/* Size */}
        <div>
          <label htmlFor="size" className={labelClass}>
            Size
          </label>
          <select
            id="size"
            value={storage.size}
            onChange={(e) =>
              setStorage((p) => ({ ...p, size: e.target.value }))
            }
            className={selectClass}
          >
            <option value="">Select size</option>
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location type */}
        <div>
          <label className={labelClass}>Location</label>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: "on_campus", label: "On Campus" },
                { value: "off_campus", label: "Off Campus" },
              ] as const
            ).map((lt) => (
              <button
                key={lt.value}
                type="button"
                onClick={() =>
                  setStorage((p) => ({ ...p, locationType: lt.value }))
                }
                className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                  storage.locationType === lt.value
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {lt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Neighborhood */}
        <div>
          <label htmlFor="neighborhood" className={labelClass}>
            Neighborhood
          </label>
          <input
            id="neighborhood"
            type="text"
            value={storage.neighborhood}
            onChange={(e) =>
              setStorage((p) => ({ ...p, neighborhood: e.target.value }))
            }
            placeholder="e.g. Hyde Park, South Loop"
            className={inputClass}
          />
        </div>

        {/* Pricing */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <label htmlFor="isFree" className="flex items-center gap-2 cursor-pointer">
              <input
                id="isFree"
                type="checkbox"
                checked={storage.isFree}
                onChange={(e) =>
                  setStorage((p) => ({ ...p, isFree: e.target.checked }))
                }
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-semibold text-gray-700">
                Free storage
              </span>
            </label>
          </div>
          {!storage.isFree && (
            <div>
              <label htmlFor="priceMonthly" className={labelClass}>
                Monthly Price ($)
              </label>
              <input
                id="priceMonthly"
                type="number"
                min="0"
                step="0.01"
                value={storage.priceMonthly}
                onChange={(e) =>
                  setStorage((p) => ({ ...p, priceMonthly: e.target.value }))
                }
                placeholder="0.00"
                className={inputClass}
              />
            </div>
          )}
        </div>

        {/* Restrictions */}
        <div>
          <label htmlFor="restrictions" className={labelClass}>
            Restrictions
          </label>
          <textarea
            id="restrictions"
            rows={3}
            value={storage.restrictions}
            onChange={(e) =>
              setStorage((p) => ({ ...p, restrictions: e.target.value }))
            }
            placeholder="e.g. No liquids, no heavy items..."
            className={inputClass + " resize-none"}
          />
        </div>
      </div>
    );
  }

  // ---------- Main render ----------

  return (
    <>
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Marketplace
          </span>
        </Link>
        <Link
          href={`/posts/${postId}`}
          className="text-sm font-medium text-gray-600 hover:text-maroon-600 transition-colors"
        >
          Cancel
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">
          Edit Post
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Update your listing details below.
        </p>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {/* Error banner */}
          {error && (
            <div className="text-sm text-maroon-700 bg-maroon-100 rounded-lg px-3 py-2.5 mb-6">
              {error}
            </div>
          )}

          {/* Readonly type & side badges */}
          <div className="flex items-center gap-2 mb-6">
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${typeBadgeClasses}`}
            >
              {typeLabel}
            </span>
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
              {sideLabel(post.side)}
            </span>
          </div>

          {/* Common fields */}
          <div className="space-y-5 mb-6">
            <div>
              <label htmlFor="title" className={labelClass}>
                Title
              </label>
              <input
                id="title"
                type="text"
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title"
                className={inputClass}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {title.length}/80
              </p>
            </div>
            <div>
              <label htmlFor="description" className={labelClass}>
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details about your listing..."
                className={inputClass + " resize-none"}
              />
            </div>
          </div>

          <hr className="border-gray-200 mb-6" />

          {/* Type-specific fields */}
          {post.marketplace && renderMarketplaceFields()}
          {post.storage && renderStorageFields()}

          {/* Submit */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
            <Link
              href={`/posts/${postId}`}
              className="text-sm font-semibold text-gray-600 border border-gray-300 px-5 py-2.5 rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-6 py-2.5 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
