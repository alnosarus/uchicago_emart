import type { MetadataRoute } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SITE_URL = "https://www.uchicagoemart.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1.0 },
    { url: `${SITE_URL}/browse`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const res = await fetch(`${API_URL}/api/posts?limit=1000`, { next: { revalidate: 3600 } });
    if (!res.ok) return staticPages;
    const data = await res.json();

    const postPages: MetadataRoute.Sitemap = (data.posts || []).map(
      (post: { id: string; updatedAt: string }) => ({
        url: `${SITE_URL}/posts/${post.id}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })
    );

    return [...staticPages, ...postPages];
  } catch {
    return staticPages;
  }
}
