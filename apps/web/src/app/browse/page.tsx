import { Suspense } from "react";
import { BrowseContent, LoadingSkeleton } from "./client-page";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Props = {
  searchParams: Promise<Record<string, string>>;
};

async function fetchInitialPosts(sp: Record<string, string>) {
  const params = new URLSearchParams();
  if (sp.type) params.set("type", sp.type);
  if (sp.side) params.set("side", sp.side);
  if (sp.category) params.set("category", sp.category);
  if (sp.condition) params.set("condition", sp.condition);
  if (sp.subtype) params.set("subtype", sp.subtype);
  if (sp.priceType) params.set("priceType", sp.priceType);
  if (sp.size) params.set("size", sp.size);
  if (sp.locationType) params.set("locationType", sp.locationType);
  if (sp.bedrooms) params.set("bedrooms", sp.bedrooms);
  if (sp.hasPhotos) params.set("hasPhotos", sp.hasPhotos);
  if (sp.moveInMonth) params.set("moveInMonth", sp.moveInMonth);
  if (sp.priceMin) params.set("priceMin", sp.priceMin);
  if (sp.priceMax) params.set("priceMax", sp.priceMax);
  if (sp.sort && sp.sort !== "recent") params.set("sort", sp.sort);
  if (sp.q) params.set("q", sp.q);
  params.set("limit", "20");

  try {
    const res = await fetch(`${API_URL}/api/posts?${params}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return { posts: [], pagination: null };
    return res.json();
  } catch {
    return { posts: [], pagination: null };
  }
}

export default async function BrowsePage({ searchParams }: Props) {
  const sp = await searchParams;
  const data = await fetchInitialPosts(sp);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-gray-50">
          <div className="bg-[#800000] px-4 sm:px-8 py-8 pb-12">
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
      <BrowseContent initialPosts={data.posts} initialPagination={data.pagination} />
    </Suspense>
  );
}
