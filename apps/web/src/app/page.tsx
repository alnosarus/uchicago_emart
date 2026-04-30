import { HomeClient } from "./client-page";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function fetchInitialPosts() {
  try {
    const res = await fetch(`${API_URL}/api/posts?type=marketplace&limit=12&page=1`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { posts: [], hasMore: false };
    const data = await res.json();
    return {
      posts: data.posts ?? [],
      hasMore: data.pagination ? data.pagination.page < data.pagination.totalPages : false,
    };
  } catch {
    return { posts: [], hasMore: false };
  }
}

export default async function Home() {
  const { posts, hasMore } = await fetchInitialPosts();
  return <HomeClient initialPosts={posts} initialHasMore={hasMore} />;
}
