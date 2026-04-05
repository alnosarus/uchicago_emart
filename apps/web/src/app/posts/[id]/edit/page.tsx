"use client";

import { useAuth } from "@/lib/auth-context";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ImageUploadGrid, type ImageItem } from "@/components/ImageUploadGrid";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PostData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  side: string;
  authorId: string;
  marketplace: {
    priceType: string;
    priceAmount: number | null;
    condition: string;
    category: string;
    tradeDescription: string | null;
    tags: string[];
  } | null;
  storage: {
    startDate: string;
    endDate: string;
    size: string;
    locationType: string;
    neighborhood: string | null;
    priceMonthly: number | null;
    isFree: boolean;
    restrictions: string | null;
  } | null;
  housing: {
    subtype: string;
    side: string;
    monthlyRent: number;
    bedrooms: string;
    bathrooms: string;
    neighborhood: string | null;
    amenities: string[];
    roommates: string;
    roommateCount: number | null;
    moveInDate: string | null;
    moveOutDate: string | null;
    leaseStartDate: string | null;
    leaseDurationMonths: number | null;
  } | null;
  images: { id: string; url: string; thumbUrl: string | null; fullUrl: string | null; order: number }[];
}

export default function EditPostPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);
  // Price state
  const [priceType, setPriceType] = useState<"fixed" | "free" | "trade">("fixed");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceMonthly, setPriceMonthly] = useState("");
  const [storageFree, setStorageFree] = useState(false);
  const [monthlyRent, setMonthlyRent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch post data
  useEffect(() => {
    if (!accessToken || !postId) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/posts/${postId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error("Post not found");
        const data = await res.json();
        setPost(data);
        setTitle(data.title);
        setDescription(data.description || "");

        // Initialize price state from post data
        if (data.marketplace) {
          setPriceType(data.marketplace.priceType as "fixed" | "free" | "trade");
          setPriceAmount(data.marketplace.priceAmount != null ? String(data.marketplace.priceAmount) : "");
        }
        if (data.storage) {
          setPriceMonthly(data.storage.priceMonthly != null ? String(data.storage.priceMonthly) : "");
          setStorageFree(data.storage.isFree);
        }
        if (data.housing) {
          setMonthlyRent(data.housing.monthlyRent != null ? String(data.housing.monthlyRent) : "");
        }

        // Convert existing images to ImageItem format
        const existingImages: ImageItem[] = data.images
          .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
          .map((img: { id: string; url: string; thumbUrl: string | null }) => ({
            type: "remote" as const,
            id: img.id,
            image: { id: img.id, url: img.url, thumbUrl: img.thumbUrl },
          }));
        setImages(existingImages);
        setOriginalImageIds(data.images.map((img: { id: string }) => img.id));
      } catch {
        setError("Failed to load post");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, postId]);

  // Redirect if not owner
  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
    if (post && user && post.authorId !== user.id) router.push(`/posts/${postId}`);
  }, [authLoading, user, post, postId, router]);

  const handleSave = useCallback(async () => {
    if (!accessToken || !post) return;
    setSubmitting(true);
    setError("");

    try {
      // 1. Update post fields including price
      const patchBody: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
      };

      if (post.type === "marketplace") {
        patchBody.marketplace = {
          priceType,
          priceAmount: priceType === "fixed" ? parseFloat(priceAmount) || 0 : null,
        };
      } else if (post.type === "storage") {
        patchBody.storage = {
          priceMonthly: storageFree ? null : parseFloat(priceMonthly) || null,
          isFree: storageFree,
        };
      } else if (post.type === "housing") {
        patchBody.housing = {
          monthlyRent: parseFloat(monthlyRent) || 0,
        };
      }

      await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(patchBody),
      });

      // 2. Delete removed images
      const currentRemoteIds = images
        .filter((img): img is Extract<ImageItem, { type: "remote" }> => img.type === "remote")
        .map((img) => img.image.id);
      const deletedIds = originalImageIds.filter((id) => !currentRemoteIds.includes(id));

      await Promise.all(
        deletedIds.map((id) =>
          fetch(`${API_URL}/api/posts/images/${id}`, {
            method: "DELETE",
            credentials: "include",
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        )
      );

      // 3. Upload new images
      const newImages = images.filter(
        (img): img is Extract<ImageItem, { type: "local" }> => img.type === "local"
      );
      if (newImages.length > 0) {
        const formData = new FormData();
        newImages.forEach((img) => formData.append("images", img.file));
        await fetch(`${API_URL}/api/posts/${postId}/images`, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
      }

      // 4. Reorder existing remote images
      const reorderedIds = images
        .filter((img): img is Extract<ImageItem, { type: "remote" }> => img.type === "remote")
        .map((img) => img.image.id);
      if (reorderedIds.length > 0) {
        await fetch(`${API_URL}/api/posts/${postId}/images/reorder`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ imageIds: reorderedIds }),
        });
      }

      router.push(`/posts/${postId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, post, postId, title, description, images, originalImageIds, router, priceType, priceAmount, priceMonthly, storageFree, monthlyRent]);

  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5";
  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-maroon-500 focus:ring-2 focus:ring-maroon-200 transition-all";

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Post not found</p>
      </div>
    );
  }

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <Link
          href={`/posts/${postId}`}
          className="text-sm font-medium text-gray-600 hover:text-maroon-600 transition-colors"
        >
          Cancel
        </Link>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Edit Post</h1>
        <p className="text-sm text-gray-500 mb-6">Update your listing details.</p>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          {error && (
            <div className="text-sm text-maroon-700 bg-maroon-100 rounded-lg px-3 py-2.5 mb-6">
              {error}
            </div>
          )}

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
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Price editing */}
            {post.type === "marketplace" && (
              <div>
                <label className={labelClass}>Price Type</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(["fixed", "free", "trade"] as const).map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPriceType(pt)}
                      className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium border transition-all ${
                        priceType === pt
                          ? "bg-maroon-600 text-white border-maroon-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {pt === "fixed" ? "Fixed Price" : pt === "free" ? "Free" : "Trade"}
                    </button>
                  ))}
                </div>
                {priceType === "fixed" && (
                  <div>
                    <label htmlFor="priceAmount" className={labelClass}>
                      Price ($) <span className="text-maroon-500">*</span>
                    </label>
                    <input
                      id="priceAmount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceAmount}
                      onChange={(e) => setPriceAmount(e.target.value)}
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            )}

            {post.type === "storage" && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    id="storageFree"
                    type="checkbox"
                    checked={storageFree}
                    onChange={(e) => setStorageFree(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500"
                  />
                  <label htmlFor="storageFree" className="text-sm font-medium text-gray-700">
                    Free storage
                  </label>
                </div>
                {!storageFree && (
                  <div>
                    <label htmlFor="priceMonthly" className={labelClass}>
                      Monthly Price ($)
                    </label>
                    <input
                      id="priceMonthly"
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceMonthly}
                      onChange={(e) => setPriceMonthly(e.target.value)}
                      className={inputClass}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            )}

            {post.type === "housing" && (
              <div>
                <label htmlFor="monthlyRent" className={labelClass}>
                  Monthly Rent ($) <span className="text-maroon-500">*</span>
                </label>
                <input
                  id="monthlyRent"
                  type="number"
                  min="0"
                  step="0.01"
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="border-t border-gray-200 my-6" />

            <ImageUploadGrid images={images} onImagesChange={setImages} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-200">
            <Link
              href={`/posts/${postId}`}
              className="text-sm font-semibold text-gray-600 border border-gray-300 px-5 py-2.5 rounded-full hover:bg-gray-50 transition-colors w-full sm:w-auto text-center"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !title.trim()}
              className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-6 py-2.5 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
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
