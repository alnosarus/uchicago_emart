"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Blurhash } from "react-blurhash";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/NotificationBell";
import { MessageBell } from "@/components/MessageBell";

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
  { value: "housing", label: "Housing" },
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

interface HousingDetails {
  subtype: "sublet" | "passdown";
  monthlyRent: number | null;
  bedrooms: string;
  bathrooms: string;
  moveInDate: string | null;
  moveOutDate: string | null;
  leaseStartDate: string | null;
  leaseDurationMonths: number | null;
}

interface PostImage {
  url: string;
  thumbUrl: string | null;
  blurHash: string | null;
  status: string;
}

interface Post {
  id: string;
  title: string;
  description: string | null;
  type: "marketplace" | "storage" | "housing";
  side: string;
  status: string;
  createdAt: string;
  author: PostAuthor;
  marketplace: MarketplaceDetails | null;
  storage: StorageDetails | null;
  housing: HousingDetails | null;
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
    if (post.marketplace.priceType === "trade") return { text: "Negotiable", isFree: false };
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
  const imageUrl = post.images.length > 0 ? (post.images[0].thumbUrl || post.images[0].url) : null;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {imageUrl ? (
          <>
            {post.images[0]?.blurHash && (
              <div className="absolute inset-0">
                <Blurhash hash={post.images[0].blurHash} width="100%" height="100%" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={post.title}
              className="relative w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          </>
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
              : post.type === "housing"
                ? "bg-indigo-100 text-indigo-700"
                : "bg-maroon-100 text-maroon-700"
          }`}
        >
          {post.type === "storage" ? "Storage" : post.type === "housing" ? "Housing" : "Marketplace"}
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

        {/* Housing info (housing only) */}
        {post.housing && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">
              {post.housing.subtype === "sublet" ? "Sublet" : "Passdown"}
            </span>
            <span className="text-xs text-gray-500">
              {post.housing.bedrooms === "studio" ? "Studio" : post.housing.bedrooms === "3_plus" ? "3+ BR" : `${post.housing.bedrooms} BR`}
            </span>
            {post.housing.subtype === "sublet" && post.housing.moveInDate && post.housing.moveOutDate && (
              <span className="text-xs text-gray-400">
                {new Date(post.housing.moveInDate).toLocaleDateString("en-US", { month: "short" })}
                {" - "}
                {new Date(post.housing.moveOutDate).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
              </span>
            )}
          </div>
        )}

        {/* Author + time */}
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
          <Link
            href={`/profile/${post.author.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 min-w-0 hover:opacity-75 transition-opacity"
          >
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
          </Link>
          <span className="text-xs text-gray-400 shrink-0">{timeAgo(post.createdAt)}</span>
        </div>
      </div>
    </Link>
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

// ── Filter Sidebar ───────────────────────────────

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
  accent = "maroon",
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  accent?: "maroon" | "indigo";
}) {
  const accentClass = accent === "indigo"
    ? "text-indigo-600 border-indigo-500"
    : "text-maroon-600 border-maroon-500";
  return (
    <label className="flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer group">
      <div
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          checked ? `bg-current border-current ${accentClass}` : "border-gray-300 group-hover:border-gray-400"
        }`}
        style={checked ? {} : undefined}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <span className={`text-sm transition-colors ${checked ? (accent === "indigo" ? "text-indigo-700 font-medium" : "text-maroon-700 font-medium") : "text-gray-600"}`}>
        {label}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    </label>
  );
}

const STORAGE_SIZES = [
  { value: "boxes", label: "Boxes" },
  { value: "half_room", label: "Half Room" },
  { value: "full_room", label: "Full Room" },
];

const LOCATION_TYPES = [
  { value: "on_campus", label: "On Campus" },
  { value: "off_campus", label: "Off Campus" },
];

const PRICE_TYPES = [
  { value: "fixed", label: "Fixed Price" },
  { value: "free", label: "Free" },
  { value: "trade", label: "Negotiable" },
];

const BEDROOMS = [
  { value: "studio", label: "Studio" },
  { value: "1", label: "1 BR" },
  { value: "2", label: "2 BR" },
  { value: "3_plus", label: "3+ BR" },
];

function getUpcomingMonths(count = 12): { value: string; label: string }[] {
  const now = new Date();
  const months = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    months.push({ value, label });
  }
  return months;
}

function FilterSidebarContent({
  activeCategories,
  activeConditions,
  activeSubtypes,
  activePriceTypes,
  activeSizes,
  activeLocationTypes,
  activeBedrooms,
  activeHasPhotos,
  activeMoveInMonth,
  priceMinInput,
  priceMaxInput,
  setPriceMinInput,
  setPriceMaxInput,
  applyPriceRange,
  activeType,
  hasFilters,
  toggleFilter,
  setFilter,
  onClearAll,
}: {
  activeCategories: string[];
  activeConditions: string[];
  activeSubtypes: string[];
  activePriceTypes: string[];
  activeSizes: string[];
  activeLocationTypes: string[];
  activeBedrooms: string[];
  activeHasPhotos: boolean;
  activeMoveInMonth: string;
  priceMinInput: string;
  priceMaxInput: string;
  setPriceMinInput: (v: string) => void;
  setPriceMaxInput: (v: string) => void;
  applyPriceRange: () => void;
  activeType: string;
  hasFilters: boolean;
  toggleFilter: (key: string, value: string) => void;
  setFilter: (key: string, value: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Has Photos */}
      <CheckItem
        label="Has photos"
        checked={activeHasPhotos}
        onChange={() => setFilter("hasPhotos", activeHasPhotos ? "" : "1")}
      />

      {/* Price Range */}
      <FilterSection title="Price">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            placeholder="Min"
            value={priceMinInput}
            onChange={(e) => setPriceMinInput(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-maroon-400 transition-colors"
          />
          <span className="text-gray-400 text-xs shrink-0">–</span>
          <input
            type="number"
            min={0}
            placeholder="Max"
            value={priceMaxInput}
            onChange={(e) => setPriceMaxInput(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-maroon-400 transition-colors"
          />
        </div>
      </FilterSection>

      {/* Price Type — marketplace or all */}
      {activeType !== "storage" && activeType !== "housing" && (
        <FilterSection title="Price Type">
          <div>
            {PRICE_TYPES.map((o) => (
              <CheckItem
                key={o.value}
                label={o.label}
                checked={activePriceTypes.includes(o.value)}
                onChange={() => toggleFilter("priceType", o.value)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Category — marketplace or all */}
      {activeType !== "storage" && activeType !== "housing" && (
        <FilterSection title="Category">
          <div>
            {CATEGORIES.map((c) => (
              <CheckItem
                key={c}
                label={c}
                checked={activeCategories.includes(c)}
                onChange={() => toggleFilter("category", c)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Condition — marketplace or all */}
      {activeType !== "storage" && activeType !== "housing" && (
        <FilterSection title="Condition">
          <div>
            {CONDITIONS.map((c) => (
              <CheckItem
                key={c.value}
                label={c.label}
                checked={activeConditions.includes(c.value)}
                onChange={() => toggleFilter("condition", c.value)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Storage Size — storage only */}
      {activeType === "storage" && (
        <FilterSection title="Size">
          <div>
            {STORAGE_SIZES.map((o) => (
              <CheckItem
                key={o.value}
                label={o.label}
                checked={activeSizes.includes(o.value)}
                onChange={() => toggleFilter("size", o.value)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Storage Location — storage only */}
      {activeType === "storage" && (
        <FilterSection title="Location">
          <div>
            {LOCATION_TYPES.map((o) => (
              <CheckItem
                key={o.value}
                label={o.label}
                checked={activeLocationTypes.includes(o.value)}
                onChange={() => toggleFilter("locationType", o.value)}
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Housing Type — housing only */}
      {activeType === "housing" && (
        <FilterSection title="Housing Type">
          <div>
            {[
              { value: "sublet", label: "Sublet" },
              { value: "passdown", label: "Passdown" },
            ].map((o) => (
              <CheckItem
                key={o.value}
                label={o.label}
                checked={activeSubtypes.includes(o.value)}
                onChange={() => toggleFilter("subtype", o.value)}
                accent="indigo"
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Bedrooms — housing only */}
      {activeType === "housing" && (
        <FilterSection title="Bedrooms">
          <div>
            {BEDROOMS.map((o) => (
              <CheckItem
                key={o.value}
                label={o.label}
                checked={activeBedrooms.includes(o.value)}
                onChange={() => toggleFilter("bedrooms", o.value)}
                accent="indigo"
              />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Move-in Month — housing sublets only */}
      {activeType === "housing" && (activeSubtypes.length === 0 || activeSubtypes.includes("sublet")) && (
        <FilterSection title="Move-in Month">
          <select
            value={activeMoveInMonth}
            onChange={(e) => setFilter("moveInMonth", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-600 outline-none focus:border-indigo-400 transition-colors cursor-pointer"
          >
            <option value="">Any month</option>
            {getUpcomingMonths().map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </FilterSection>
      )}

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={onClearAll}
          className="w-full text-xs text-gray-500 hover:text-gray-700 underline text-left transition-colors pt-1"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ── Main Browse Content ──────────────────────────

function BrowseContent() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read filter state from URL
  const activeType = searchParams.get("type") || "";
  const activeCategories = (searchParams.get("category") || "").split(",").filter(Boolean);
  const activeConditions = (searchParams.get("condition") || "").split(",").filter(Boolean);
  const activeSubtypes = (searchParams.get("subtype") || "").split(",").filter(Boolean);
  const activePriceTypes = (searchParams.get("priceType") || "").split(",").filter(Boolean);
  const activeSizes = (searchParams.get("size") || "").split(",").filter(Boolean);
  const activeLocationTypes = (searchParams.get("locationType") || "").split(",").filter(Boolean);
  const activeBedrooms = (searchParams.get("bedrooms") || "").split(",").filter(Boolean);
  const activeHasPhotos = searchParams.get("hasPhotos") === "1";
  const activeMoveInMonth = searchParams.get("moveInMonth") || "";
  const activePriceMin = searchParams.get("priceMin") || "";
  const activePriceMax = searchParams.get("priceMax") || "";
  const activeSort = searchParams.get("sort") || "recent";
  const activeQ = searchParams.get("q") || "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(activeQ);
  const [priceMinInput, setPriceMinInput] = useState(activePriceMin);
  const [priceMaxInput, setPriceMaxInput] = useState(activePriceMax);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Infinite scroll state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Track searchParams changes to reset pagination
  const paramsString = searchParams.toString();
  const prevParamsRef = useRef(paramsString);

  useEffect(() => {
    if (prevParamsRef.current !== paramsString) {
      prevParamsRef.current = paramsString;
      setPosts([]);
      setPage(1);
      setHasMore(true);
    }
  }, [paramsString]);

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

  // Toggle a value in a comma-separated multi-select URL param
  const toggleFilter = useCallback(
    (key: string, value: string) => {
      const current = (searchParams.get(key) || "").split(",").filter(Boolean);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      router.push(buildUrl({ [key]: next.join(",") }));
    },
    [router, buildUrl, searchParams]
  );

  // Fetch posts — runs when filters change (page resets to 1) or page increments
  useEffect(() => {
    let cancelled = false;

    async function fetchPosts() {
      if (page === 1) {
        setIsLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (activeType) params.set("type", activeType);
      if (activeCategories.length) params.set("category", activeCategories.join(","));
      if (activeConditions.length) params.set("condition", activeConditions.join(","));
      if (activeSubtypes.length) params.set("subtype", activeSubtypes.join(","));
      if (activePriceTypes.length) params.set("priceType", activePriceTypes.join(","));
      if (activeSizes.length) params.set("size", activeSizes.join(","));
      if (activeLocationTypes.length) params.set("locationType", activeLocationTypes.join(","));
      if (activeBedrooms.length) params.set("bedrooms", activeBedrooms.join(","));
      if (activeHasPhotos) params.set("hasPhotos", "1");
      if (activeMoveInMonth) params.set("moveInMonth", activeMoveInMonth);
      if (activePriceMin) params.set("priceMin", activePriceMin);
      if (activePriceMax) params.set("priceMax", activePriceMax);
      if (activeSort && activeSort !== "recent") params.set("sort", activeSort);
      if (activeQ) params.set("q", activeQ);
      if (page > 1) params.set("page", String(page));
      params.set("limit", "20");

      try {
        const res = await fetch(`${API_URL}/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load posts");
        const data: PostsResponse = await res.json();
        if (!cancelled) {
          if (page === 1) {
            setPosts(data.posts);
          } else {
            setPosts((prev) => [...prev, ...data.posts]);
          }
          setPagination(data.pagination);
          setHasMore(data.pagination.page < data.pagination.totalPages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setLoadingMore(false);
        }
      }
    }

    fetchPosts();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsString, page]);

  // IntersectionObserver: load next page when sentinel enters viewport
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !loadingMore) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, isLoading, loadingMore]);

  // Sync local search input when URL changes externally
  useEffect(() => {
    setSearchInput(activeQ);
  }, [activeQ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilter("q", searchInput.trim());
  };

  const hasFilters = !!(
    activeType || activeCategories.length || activeConditions.length ||
    activeSubtypes.length || activePriceTypes.length || activeSizes.length ||
    activeLocationTypes.length || activeBedrooms.length || activeHasPhotos ||
    activeMoveInMonth || activePriceMin || activePriceMax || activeQ
  );

  // Sync price inputs when URL changes externally
  useEffect(() => { setPriceMinInput(activePriceMin); }, [activePriceMin]);
  useEffect(() => { setPriceMaxInput(activePriceMax); }, [activePriceMax]);

  const applyPriceRange = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (priceMinInput) params.set("priceMin", priceMinInput); else params.delete("priceMin");
    if (priceMaxInput) params.set("priceMax", priceMaxInput); else params.delete("priceMax");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {authLoading ? (
            <div className="w-16 sm:w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
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
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold">
                      {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                    <Link href={`/profile/${user.id}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
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

      {/* Header */}
      <div className="bg-gradient-to-br from-maroon-800 to-maroon-600 px-4 sm:px-8 py-8 pb-12">
        <div className="max-w-7xl mx-auto">
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

      {/* Type tabs bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-14 sm:top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center gap-0 -mb-px">
            {/* Type tabs */}
            <div className="flex items-center gap-0 overflow-x-auto flex-1">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter("type", tab.value)}
                  className={`px-3 sm:px-5 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    activeType === tab.value
                      ? "border-maroon-600 text-maroon-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-1 shrink-0 pl-2">
              {/* Sort dropdown */}
              <div className="relative">
                {sortOpen && <div className="fixed inset-0 z-40" onClick={() => setSortOpen(false)} />}
                <button
                  onClick={() => setSortOpen(!sortOpen)}
                  title="Sort"
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm transition-colors relative z-50 ${
                    activeSort !== "recent" ? "text-maroon-700" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {/* Sort icon: lines + arrow */}
                  {activeSort === "price_asc" ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="14" y2="6" /><line x1="3" y1="12" x2="11" y2="12" /><line x1="3" y1="18" x2="8" y2="18" />
                      <polyline points="17 3 21 7 17 11" /><line x1="21" y1="7" x2="15" y2="7" />
                    </svg>
                  ) : activeSort === "price_desc" ? (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="14" y2="6" /><line x1="3" y1="12" x2="11" y2="12" /><line x1="3" y1="18" x2="8" y2="18" />
                      <polyline points="17 11 21 7 17 3" /><line x1="21" y1="7" x2="15" y2="7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="9" y1="18" x2="15" y2="18" />
                    </svg>
                  )}
                  <span className="hidden sm:inline text-xs">{SORT_OPTIONS.find(o => o.value === activeSort)?.label}</span>
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                    {SORT_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => { setFilter("sort", o.value === "recent" ? "" : o.value); setSortOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                          activeSort === o.value
                            ? "text-maroon-700 font-medium bg-maroon-50"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {o.label}
                        {activeSort === o.value && (
                          <svg className="w-3.5 h-3.5 text-maroon-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile filter toggle */}
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors sm:hidden shrink-0 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
                  <circle cx="2" cy="6" r="1" fill="currentColor" stroke="none" />
                  <circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" />
                  <circle cx="10" cy="18" r="1" fill="currentColor" stroke="none" />
                </svg>
                {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-maroon-600" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Filter Sidebar ── */}
          <aside className="w-52 shrink-0 bg-white rounded-xl border border-gray-100 shadow-sm p-4 hidden sm:block sticky top-28 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <p className="text-sm font-semibold text-gray-900 mb-4">Filters</p>
            <FilterSidebarContent
              activeCategories={activeCategories}
              activeConditions={activeConditions}
              activeSubtypes={activeSubtypes}
              activePriceTypes={activePriceTypes}
              activeSizes={activeSizes}
              activeLocationTypes={activeLocationTypes}
              activeBedrooms={activeBedrooms}
              activeHasPhotos={activeHasPhotos}
              activeMoveInMonth={activeMoveInMonth}
              priceMinInput={priceMinInput}
              priceMaxInput={priceMaxInput}
              setPriceMinInput={setPriceMinInput}
              setPriceMaxInput={setPriceMaxInput}
              applyPriceRange={applyPriceRange}
              activeType={activeType}
              hasFilters={hasFilters}
              toggleFilter={toggleFilter}
              setFilter={setFilter}
              onClearAll={() => { setSearchInput(""); setPriceMinInput(""); setPriceMaxInput(""); router.push(pathname); }}
            />
          </aside>

          {/* ── Mobile filter drawer ── */}
          {filtersOpen && (
            <>
              <div
                className="fixed inset-0 bg-black/30 z-40 sm:hidden"
                onClick={() => setFiltersOpen(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 p-5 shadow-xl sm:hidden max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Filters</h2>
                  <button onClick={() => setFiltersOpen(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <FilterSidebarContent
                  activeCategories={activeCategories}
                  activeConditions={activeConditions}
                  activeSubtypes={activeSubtypes}
                  activePriceTypes={activePriceTypes}
                  activeSizes={activeSizes}
                  activeLocationTypes={activeLocationTypes}
                  activeBedrooms={activeBedrooms}
                  activeHasPhotos={activeHasPhotos}
                  activeMoveInMonth={activeMoveInMonth}
                  priceMinInput={priceMinInput}
                  priceMaxInput={priceMaxInput}
                  setPriceMinInput={setPriceMinInput}
                  setPriceMaxInput={setPriceMaxInput}
                  applyPriceRange={applyPriceRange}
                  activeType={activeType}
                  hasFilters={hasFilters}
                  toggleFilter={toggleFilter}
                  setFilter={setFilter}
                  onClearAll={() => { setSearchInput(""); setPriceMinInput(""); setPriceMaxInput(""); router.push(pathname); setFiltersOpen(false); }}
                />
              </div>
            </>
          )}

          {/* ── Posts column ── */}
          <div className="flex-1 min-w-0">
            {/* Active filter chips */}
            {hasFilters && (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs text-gray-500 font-medium">Active:</span>
                {activeQ && (
                  <button
                    onClick={() => { setSearchInput(""); setFilter("q", ""); }}
                    className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors"
                  >
                    &ldquo;{activeQ}&rdquo;
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {activeType && (
                  <button onClick={() => setFilter("type", "")} className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors">
                    {activeType === "marketplace" ? "Marketplace" : activeType === "housing" ? "Housing" : "Storage"}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {activeHasPhotos && (
                  <button onClick={() => setFilter("hasPhotos", "")} className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors">
                    Has photos
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {(activePriceMin || activePriceMax) && (
                  <button onClick={() => { setPriceMinInput(""); setPriceMaxInput(""); setFilter("priceMin", ""); setFilter("priceMax", ""); }} className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors">
                    {activePriceMin && activePriceMax ? `$${activePriceMin}–$${activePriceMax}` : activePriceMin ? `≥$${activePriceMin}` : `≤$${activePriceMax}`}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {activePriceTypes.map((p) => (
                  <button key={p} onClick={() => toggleFilter("priceType", p)} className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors">
                    {PRICE_TYPES.find(o => o.value === p)?.label ?? p}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                {activeSubtypes.map((s) => (
                  <button key={s} onClick={() => toggleFilter("subtype", s)} className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors">
                    {s === "sublet" ? "Sublet" : "Passdown"}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                {activeBedrooms.map((b) => (
                  <button key={b} onClick={() => toggleFilter("bedrooms", b)} className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors">
                    {BEDROOMS.find(o => o.value === b)?.label ?? b}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                {activeMoveInMonth && (
                  <button onClick={() => setFilter("moveInMonth", "")} className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full hover:bg-indigo-100 transition-colors">
                    Move-in: {new Date(activeMoveInMonth + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {activeSizes.map((s) => (
                  <button key={s} onClick={() => toggleFilter("size", s)} className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors">
                    {STORAGE_SIZES.find(o => o.value === s)?.label ?? s}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                {activeLocationTypes.map((l) => (
                  <button key={l} onClick={() => toggleFilter("locationType", l)} className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full hover:bg-amber-100 transition-colors">
                    {LOCATION_TYPES.find(o => o.value === l)?.label ?? l}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                {activeCategories.map((c) => (
                  <button key={c} onClick={() => toggleFilter("category", c)} className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors">
                    {c}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                {activeConditions.map((c) => (
                  <button key={c} onClick={() => toggleFilter("condition", c)} className="inline-flex items-center gap-1 text-xs font-medium bg-maroon-50 text-maroon-700 px-2.5 py-1 rounded-full hover:bg-maroon-100 transition-colors">
                    {conditionLabel(c)}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                ))}
                <button
                  onClick={() => { setSearchInput(""); setPriceMinInput(""); setPriceMaxInput(""); router.push(pathname); }}
                  className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}

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
                <button onClick={() => router.refresh()} className="text-sm font-medium text-maroon-600 hover:text-maroon-700 underline">
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

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
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
            <div className="max-w-7xl mx-auto">
              <div className="h-8 w-48 bg-white/20 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-white/10 rounded animate-pulse mb-5" />
              <div className="h-11 max-w-2xl bg-white/20 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6">
            <LoadingSkeleton />
          </div>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
