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
      // 1. Update post text fields
      await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
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
  }, [accessToken, post, postId, title, description, images, originalImageIds, router]);

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
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
          <span className="hidden sm:inline text-sm font-medium text-gray-400 uppercase tracking-wider">
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

            <div className="border-t border-gray-200 my-6" />

            <ImageUploadGrid images={images} onImagesChange={setImages} />
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            <Link
              href={`/posts/${postId}`}
              className="text-sm font-semibold text-gray-600 border border-gray-300 px-5 py-2.5 rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
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
