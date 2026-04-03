"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  HOUSING_AMENITIES,
  BEDROOM_OPTIONS,
  BATHROOM_OPTIONS,
  LEASE_DURATION_OPTIONS,
} from "@uchicago-marketplace/shared";

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

type PostType = "marketplace" | "storage" | "housing";

interface MarketplaceFields {
  side: "sell" | "buy";
  priceType: "fixed" | "free" | "trade";
  priceAmount: string;
  condition: string;
  category: string;
  tags: string;
}

interface StorageFields {
  side: "has_space" | "need_storage";
  startDate: string;
  endDate: string;
  size: string;
  locationType: "on_campus" | "off_campus";
  neighborhood: string;
  priceMonthly: string;
  isFree: boolean;
}

interface HousingFields {
  subtype: "sublet" | "passdown";
  side: "offering" | "looking";
  monthlyRent: string;
  bedrooms: string;
  bathrooms: string;
  moveInDate: string;
  moveOutDate: string;
  leaseStartDate: string;
  leaseDurationMonths: string;
  neighborhood: string;
  amenities: string[];
  roommates: "solo" | "shared";
  roommateCount: string;
}

export default function CreatePostPage() {
  const { user, accessToken, isLoading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [marketplace, setMarketplace] = useState<MarketplaceFields>({
    side: "sell",
    priceType: "fixed",
    priceAmount: "",
    condition: "",
    category: "",
    tags: "",
  });

  const [storage, setStorage] = useState<StorageFields>({
    side: "has_space",
    startDate: "",
    endDate: "",
    size: "",
    locationType: "on_campus",
    neighborhood: "",
    priceMonthly: "",
    isFree: false,
  });

  const [housing, setHousing] = useState<HousingFields>({
    subtype: "sublet",
    side: "offering",
    monthlyRent: "",
    bedrooms: "",
    bathrooms: "",
    moveInDate: "",
    moveOutDate: "",
    leaseStartDate: "",
    leaseDurationMonths: "",
    neighborhood: "",
    amenities: [],
    roommates: "solo",
    roommateCount: "",
  });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // --- Step validation ---

  function canProceedToStep2() {
    return postType !== null;
  }

  function canProceedToStep3() {
    return title.trim().length > 0 && title.trim().length <= 80;
  }

  function canProceedToStep4() {
    if (postType === "marketplace") {
      if (!marketplace.condition || !marketplace.category) return false;
      if (marketplace.priceType === "fixed" && !marketplace.priceAmount) return false;
      return true;
    }
    if (postType === "storage") {
      if (!storage.startDate || !storage.endDate || !storage.size) return false;
      return true;
    }
    if (postType === "housing") {
      if (!housing.side || !housing.monthlyRent || !housing.bedrooms || !housing.bathrooms || !housing.roommates) return false;
      if (housing.subtype === "sublet" && (!housing.moveInDate || !housing.moveOutDate)) return false;
      if (housing.subtype === "passdown" && (!housing.leaseStartDate || !housing.leaseDurationMonths)) return false;
      return true;
    }
    return false;
  }

  // --- Build payload ---

  function buildPayload() {
    if (postType === "marketplace") {
      return {
        type: "marketplace" as const,
        side: marketplace.side,
        title: title.trim(),
        description: description.trim() || null,
        marketplace: {
          priceType: marketplace.priceType,
          priceAmount:
            marketplace.priceType === "fixed"
              ? parseFloat(marketplace.priceAmount) || 0
              : null,
          condition: marketplace.condition,
          category: marketplace.category,
          tradeDescription: null,
          tags: marketplace.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      };
    }
    if (postType === "housing") {
      return {
        type: "housing" as const,
        side: housing.side,
        title: title.trim(),
        description: description.trim() || null,
        housing: {
          subtype: housing.subtype,
          side: housing.side,
          monthlyRent: parseFloat(housing.monthlyRent) || 0,
          bedrooms: housing.bedrooms,
          bathrooms: housing.bathrooms,
          neighborhood: housing.neighborhood.trim() || null,
          amenities: housing.amenities,
          roommates: housing.roommates,
          roommateCount:
            housing.roommates === "shared"
              ? parseInt(housing.roommateCount, 10) || null
              : null,
          moveInDate: housing.subtype === "sublet" ? housing.moveInDate : null,
          moveOutDate: housing.subtype === "sublet" ? housing.moveOutDate : null,
          leaseStartDate: housing.subtype === "passdown" ? housing.leaseStartDate : null,
          leaseDurationMonths:
            housing.subtype === "passdown"
              ? parseInt(housing.leaseDurationMonths, 10) || null
              : null,
        },
      };
    }
    return {
      type: "storage" as const,
      side: storage.side,
      title: title.trim(),
      description: description.trim() || null,
      storage: {
        startDate: storage.startDate,
        endDate: storage.endDate,
        size: storage.size,
        locationType: storage.locationType,
        neighborhood: storage.neighborhood.trim() || null,
        priceMonthly: storage.isFree
          ? null
          : parseFloat(storage.priceMonthly) || null,
        isFree: storage.isFree,
        restrictions: null,
      },
    };
  }

  // --- Submit ---

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/posts`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Request failed (${res.status})`);
      }
      const post = await res.json();
      router.push(`/posts/${post.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // --- Shared UI helpers ---

  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all";
  const selectClass =
    "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 bg-white outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all";

  // --- Step renderers ---

  function renderStepIndicator() {
    const steps = ["Type", "Details", postType === "storage" ? "Storage" : postType === "housing" ? "Housing" : "Listing", "Review"];
    return (
      <div className="flex items-center justify-center gap-1 mb-8">
        {steps.map((label, i) => {
          const n = i + 1;
          const isActive = step === n;
          const isCompleted = step > n;
          return (
            <div key={n} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (isCompleted) setStep(n);
                }}
                disabled={!isCompleted}
                className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-maroon-600 to-maroon-700 text-white shadow-md"
                    : isCompleted
                      ? "bg-maroon-100 text-maroon-700 hover:bg-maroon-200 cursor-pointer"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  n
                )}
              </button>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive ? "text-maroon-700" : isCompleted ? "text-maroon-500" : "text-gray-400"
                }`}
              >
                {label}
              </span>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 rounded ${isCompleted ? "bg-maroon-300" : "bg-gray-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderStep1() {
    return (
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">What would you like to post?</h2>
        <p className="text-sm text-gray-500 mb-6">Choose the type of listing you want to create.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setPostType("marketplace")}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              postType === "marketplace"
                ? "border-maroon-600 bg-maroon-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="text-2xl mb-2">🛒</div>
            <h3 className="text-base font-bold text-gray-900">Marketplace</h3>
            <p className="text-sm text-gray-500 mt-1">Buy or sell items with fellow Maroons</p>
          </button>
          <button
            type="button"
            onClick={() => setPostType("storage")}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              postType === "storage"
                ? "border-amber-500 bg-amber-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="text-2xl mb-2">📦</div>
            <h3 className="text-base font-bold text-gray-900">Storage</h3>
            <p className="text-sm text-gray-500 mt-1">Find or offer storage space on/off campus</p>
          </button>
          <button
            type="button"
            onClick={() => setPostType("housing")}
            className={`p-6 rounded-xl border-2 text-left transition-all ${
              postType === "housing"
                ? "border-indigo-500 bg-indigo-50 shadow-md"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
            }`}
          >
            <div className="text-2xl mb-2">🏠</div>
            <h3 className="text-base font-bold text-gray-900">Housing</h3>
            <p className="text-sm text-gray-500 mt-1">Sublets & passdowns</p>
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    return (
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Basic Info</h2>
        <p className="text-sm text-gray-500 mb-6">Give your post a title and optional description.</p>
        <div className="space-y-5">
          <div>
            <label htmlFor="title" className={labelClass}>
              Title <span className="text-maroon-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                postType === "marketplace"
                  ? 'e.g. "Organic Chemistry Textbook 4th Edition"'
                  : postType === "housing"
                    ? 'e.g. "Sunny 1BR sublet near campus, Jun-Aug"'
                    : 'e.g. "Storage space near campus for summer"'
              }
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/80</p>
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
      </div>
    );
  }

  function renderStep3Marketplace() {
    return (
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Listing Details</h2>
        <p className="text-sm text-gray-500 mb-6">Configure your marketplace listing.</p>
        <div className="space-y-5">
          {/* Side */}
          <div>
            <label className={labelClass}>I want to...</label>
            <div className="grid grid-cols-2 gap-3">
              {(["sell", "buy"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMarketplace((p) => ({ ...p, side: s }))}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    marketplace.side === s
                      ? "border-maroon-600 bg-maroon-50 text-maroon-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s === "sell" ? "Sell" : "Buy"}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className={labelClass}>
              Category <span className="text-maroon-500">*</span>
            </label>
            <select
              id="category"
              value={marketplace.category}
              onChange={(e) => setMarketplace((p) => ({ ...p, category: e.target.value }))}
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
              Condition <span className="text-maroon-500">*</span>
            </label>
            <select
              id="condition"
              value={marketplace.condition}
              onChange={(e) => setMarketplace((p) => ({ ...p, condition: e.target.value }))}
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
                  onClick={() => setMarketplace((p) => ({ ...p, priceType: pt }))}
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
                Price ($) <span className="text-maroon-500">*</span>
              </label>
              <input
                id="priceAmount"
                type="number"
                min="0"
                step="0.01"
                value={marketplace.priceAmount}
                onChange={(e) => setMarketplace((p) => ({ ...p, priceAmount: e.target.value }))}
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
              onChange={(e) => setMarketplace((p) => ({ ...p, tags: e.target.value }))}
              placeholder="e.g. chemistry, textbook, science (comma-separated)"
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">Separate tags with commas</p>
          </div>
        </div>
      </div>
    );
  }

  function renderStep3Storage() {
    return (
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Storage Details</h2>
        <p className="text-sm text-gray-500 mb-6">Configure your storage listing.</p>
        <div className="space-y-5">
          {/* Side */}
          <div>
            <label className={labelClass}>I...</label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "has_space", label: "Have space" },
                  { value: "need_storage", label: "Need storage" },
                ] as const
              ).map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStorage((p) => ({ ...p, side: s.value }))}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    storage.side === s.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className={labelClass}>
                Start Date <span className="text-maroon-500">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={storage.startDate}
                onChange={(e) => setStorage((p) => ({ ...p, startDate: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="endDate" className={labelClass}>
                End Date <span className="text-maroon-500">*</span>
              </label>
              <input
                id="endDate"
                type="date"
                value={storage.endDate}
                onChange={(e) => setStorage((p) => ({ ...p, endDate: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          {/* Size */}
          <div>
            <label htmlFor="size" className={labelClass}>
              Size <span className="text-maroon-500">*</span>
            </label>
            <select
              id="size"
              value={storage.size}
              onChange={(e) => setStorage((p) => ({ ...p, size: e.target.value }))}
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
                  onClick={() => setStorage((p) => ({ ...p, locationType: lt.value }))}
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
              onChange={(e) => setStorage((p) => ({ ...p, neighborhood: e.target.value }))}
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
                  onChange={(e) => setStorage((p) => ({ ...p, isFree: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-semibold text-gray-700">Free storage</span>
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
                  onChange={(e) => setStorage((p) => ({ ...p, priceMonthly: e.target.value }))}
                  placeholder="0.00"
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderStep3Housing() {
    return (
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Housing Details</h2>
        <p className="text-sm text-gray-500 mb-6">Configure your housing listing.</p>
        <div className="space-y-5">
          {/* Subtype */}
          <div>
            <label className={labelClass}>Type</label>
            <div className="grid grid-cols-2 gap-3">
              {(["sublet", "passdown"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setHousing((p) => ({ ...p, subtype: s }))}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    housing.subtype === s
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s === "sublet" ? "Sublet" : "Passdown"}
                </button>
              ))}
            </div>
          </div>

          {/* Side */}
          <div>
            <label className={labelClass}>I am... <span className="text-maroon-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "offering", label: "Offering" },
                  { value: "looking", label: "Looking for" },
                ] as const
              ).map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setHousing((p) => ({ ...p, side: s.value }))}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    housing.side === s.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Monthly rent */}
          <div>
            <label htmlFor="monthlyRent" className={labelClass}>
              Monthly Rent ($) <span className="text-maroon-500">*</span>
            </label>
            <input
              id="monthlyRent"
              type="number"
              min="0"
              step="1"
              value={housing.monthlyRent}
              onChange={(e) => setHousing((p) => ({ ...p, monthlyRent: e.target.value }))}
              placeholder="0"
              className={inputClass}
            />
          </div>

          {/* Bedrooms & Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bedrooms" className={labelClass}>
                Bedrooms <span className="text-maroon-500">*</span>
              </label>
              <select
                id="bedrooms"
                value={housing.bedrooms}
                onChange={(e) => setHousing((p) => ({ ...p, bedrooms: e.target.value }))}
                className={selectClass}
              >
                <option value="">Select</option>
                {BEDROOM_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bathrooms" className={labelClass}>
                Bathrooms <span className="text-maroon-500">*</span>
              </label>
              <select
                id="bathrooms"
                value={housing.bathrooms}
                onChange={(e) => setHousing((p) => ({ ...p, bathrooms: e.target.value }))}
                className={selectClass}
              >
                <option value="">Select</option>
                {BATHROOM_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date fields: sublet vs passdown */}
          {housing.subtype === "sublet" ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="moveInDate" className={labelClass}>
                  Move-in Date <span className="text-maroon-500">*</span>
                </label>
                <input
                  id="moveInDate"
                  type="date"
                  value={housing.moveInDate}
                  onChange={(e) => setHousing((p) => ({ ...p, moveInDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="moveOutDate" className={labelClass}>
                  Move-out Date <span className="text-maroon-500">*</span>
                </label>
                <input
                  id="moveOutDate"
                  type="date"
                  value={housing.moveOutDate}
                  onChange={(e) => setHousing((p) => ({ ...p, moveOutDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="leaseStartDate" className={labelClass}>
                  Lease Start Date <span className="text-maroon-500">*</span>
                </label>
                <input
                  id="leaseStartDate"
                  type="date"
                  value={housing.leaseStartDate}
                  onChange={(e) => setHousing((p) => ({ ...p, leaseStartDate: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="leaseDuration" className={labelClass}>
                  Lease Duration <span className="text-maroon-500">*</span>
                </label>
                <select
                  id="leaseDuration"
                  value={housing.leaseDurationMonths}
                  onChange={(e) => setHousing((p) => ({ ...p, leaseDurationMonths: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select</option>
                  {LEASE_DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Neighborhood */}
          <div>
            <label htmlFor="housingNeighborhood" className={labelClass}>
              Neighborhood
            </label>
            <input
              id="housingNeighborhood"
              type="text"
              value={housing.neighborhood}
              onChange={(e) => setHousing((p) => ({ ...p, neighborhood: e.target.value }))}
              placeholder="e.g. Hyde Park, South Loop"
              className={inputClass}
            />
          </div>

          {/* Amenities */}
          <div>
            <label className={labelClass}>Amenities</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {HOUSING_AMENITIES.map((a) => (
                <label key={a.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={housing.amenities.includes(a.value)}
                    onChange={(e) => {
                      setHousing((p) => ({
                        ...p,
                        amenities: e.target.checked
                          ? [...p.amenities, a.value]
                          : p.amenities.filter((v) => v !== a.value),
                      }));
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Roommates */}
          <div>
            <label className={labelClass}>Roommates <span className="text-maroon-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: "solo", label: "Solo" },
                  { value: "shared", label: "Shared" },
                ] as const
              ).map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setHousing((p) => ({ ...p, roommates: r.value }))}
                  className={`py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                    housing.roommates === r.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {housing.roommates === "shared" && (
              <div className="mt-3">
                <label htmlFor="roommateCount" className={labelClass}>
                  Number of Roommates
                </label>
                <input
                  id="roommateCount"
                  type="number"
                  min="1"
                  value={housing.roommateCount}
                  onChange={(e) => setHousing((p) => ({ ...p, roommateCount: e.target.value }))}
                  placeholder="e.g. 2"
                  className={inputClass}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderStep4() {
    const payload = buildPayload();
    return (
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 mb-1">Review Your Post</h2>
        <p className="text-sm text-gray-500 mb-6">Make sure everything looks good before publishing.</p>

        <div className="space-y-4">
          {/* Type & side */}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                postType === "marketplace"
                  ? "bg-maroon-100 text-maroon-700"
                  : postType === "housing"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {postType}
            </span>
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 capitalize">
              {payload.side.replace("_", " ")}
            </span>
          </div>

          {/* Title & description */}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{payload.title}</h3>
            {payload.description && (
              <p className="text-sm text-gray-600 mt-1">{payload.description}</p>
            )}
          </div>

          {/* Type-specific details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            {postType === "marketplace" && payload.type === "marketplace" && (
              <>
                <DetailRow label="Category" value={payload.marketplace.category} />
                <DetailRow
                  label="Condition"
                  value={CONDITIONS.find((c) => c.value === payload.marketplace.condition)?.label || payload.marketplace.condition}
                />
                <DetailRow
                  label="Price"
                  value={
                    payload.marketplace.priceType === "free"
                      ? "Free"
                      : payload.marketplace.priceType === "trade"
                        ? "Trade"
                        : `$${(payload.marketplace.priceAmount ?? 0).toFixed(2)}`
                  }
                />
                {payload.marketplace.tags.length > 0 && (
                  <DetailRow label="Tags" value={payload.marketplace.tags.join(", ")} />
                )}
              </>
            )}
            {postType === "storage" && payload.type === "storage" && (
              <>
                <DetailRow
                  label="Size"
                  value={SIZES.find((s) => s.value === payload.storage.size)?.label || payload.storage.size}
                />
                <DetailRow
                  label="Dates"
                  value={`${payload.storage.startDate} to ${payload.storage.endDate}`}
                />
                <DetailRow
                  label="Location"
                  value={payload.storage.locationType === "on_campus" ? "On Campus" : "Off Campus"}
                />
                {payload.storage.neighborhood && (
                  <DetailRow label="Neighborhood" value={payload.storage.neighborhood} />
                )}
                <DetailRow
                  label="Price"
                  value={
                    payload.storage.isFree
                      ? "Free"
                      : payload.storage.priceMonthly
                        ? `$${payload.storage.priceMonthly.toFixed(2)}/month`
                        : "Not specified"
                  }
                />
              </>
            )}
            {postType === "housing" && payload.type === "housing" && (
              <>
                <DetailRow label="Subtype" value={payload.housing.subtype === "sublet" ? "Sublet" : "Passdown"} />
                <DetailRow label="Side" value={payload.housing.subtype === "sublet" ? (housing.side === "offering" ? "Offering" : "Looking for") : (housing.side === "offering" ? "Offering" : "Looking for")} />
                <DetailRow label="Monthly Rent" value={`$${payload.housing.monthlyRent.toFixed(2)}/mo`} />
                <DetailRow
                  label="Bedrooms"
                  value={BEDROOM_OPTIONS.find((b) => b.value === payload.housing.bedrooms)?.label || payload.housing.bedrooms}
                />
                <DetailRow
                  label="Bathrooms"
                  value={BATHROOM_OPTIONS.find((b) => b.value === payload.housing.bathrooms)?.label || payload.housing.bathrooms}
                />
                {payload.housing.subtype === "sublet" && payload.housing.moveInDate && payload.housing.moveOutDate && (
                  <DetailRow label="Dates" value={`${payload.housing.moveInDate} to ${payload.housing.moveOutDate}`} />
                )}
                {payload.housing.subtype === "passdown" && payload.housing.leaseStartDate && (
                  <DetailRow
                    label="Lease"
                    value={`Starts ${payload.housing.leaseStartDate}${payload.housing.leaseDurationMonths ? ` (${payload.housing.leaseDurationMonths} months)` : ""}`}
                  />
                )}
                {payload.housing.neighborhood && (
                  <DetailRow label="Neighborhood" value={payload.housing.neighborhood} />
                )}
                <DetailRow label="Roommates" value={payload.housing.roommates === "solo" ? "Solo" : `Shared${payload.housing.roommateCount ? ` (${payload.housing.roommateCount})` : ""}`} />
                {payload.housing.amenities.length > 0 && (
                  <DetailRow
                    label="Amenities"
                    value={payload.housing.amenities
                      .map((a) => HOUSING_AMENITIES.find((h) => h.value === a)?.label || a)
                      .join(", ")}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Main render ---

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
          href="/"
          className="text-sm font-medium text-gray-600 hover:text-maroon-600 transition-colors"
        >
          Cancel
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Create a Post</h1>
        <p className="text-sm text-gray-500 mb-6">Share your listing with the UChicago community.</p>

        {renderStepIndicator()}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {error && (
            <div className="text-sm text-maroon-700 bg-maroon-100 rounded-lg px-3 py-2.5 mb-6">
              {error}
            </div>
          )}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && postType === "marketplace" && renderStep3Marketplace()}
          {step === 3 && postType === "storage" && renderStep3Storage()}
          {step === 3 && postType === "housing" && renderStep3Housing()}
          {step === 4 && renderStep4()}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="text-sm font-semibold text-gray-600 border border-gray-300 px-5 py-2.5 rounded-full hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && !canProceedToStep2()) ||
                  (step === 2 && !canProceedToStep3()) ||
                  (step === 3 && !canProceedToStep4())
                }
                onClick={() => setStep((s) => s + 1)}
                className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-6 py-2.5 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-6 py-2.5 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish Post"
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm font-medium text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-800 text-right">{value}</span>
    </div>
  );
}
