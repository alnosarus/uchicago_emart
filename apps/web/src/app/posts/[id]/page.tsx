import type { Metadata } from "next";
import PostDetailPage from "./client-page";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SITE_URL = "https://www.uchicagoemart.com";

type Props = {
  params: Promise<{ id: string }>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function buildAutoDescription(post: any): string {
  if (post.type === "marketplace" && post.marketplace) {
    const price =
      post.marketplace.priceType === "free"
        ? "Free"
        : post.marketplace.priceType === "trade"
          ? "Negotiable"
          : post.marketplace.priceAmount != null
            ? `$${post.marketplace.priceAmount.toFixed(2)}`
            : "";
    const condition = post.marketplace.condition?.replace("_", " ") || "";
    return `${post.marketplace.category} for ${post.side} — ${condition}${price ? `, ${price}` : ""}. Browse more on UChicago Marketplace.`;
  }
  if (post.type === "storage" && post.storage) {
    const price = post.storage.isFree ? "Free" : post.storage.priceMonthly ? `$${post.storage.priceMonthly}/mo` : "";
    return `Storage space ${post.side === "has_space" ? "available" : "needed"}${price ? ` — ${price}` : ""}. Find storage on UChicago Marketplace.`;
  }
  if (post.type === "housing" && post.housing) {
    const price = post.housing.monthlyRent ? `$${post.housing.monthlyRent}/mo` : "";
    return `Housing ${post.housing.subtype}${price ? ` — ${price}` : ""}. Find housing on UChicago Marketplace.`;
  }
  return "View this listing on UChicago Marketplace.";
}

async function fetchPost(id: string) {
  try {
    const res = await fetch(`${API_URL}/api/posts/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function buildConditionUrl(condition: string): string {
  const map: Record<string, string> = {
    new: "https://schema.org/NewCondition",
    new_item: "https://schema.org/NewCondition",
    like_new: "https://schema.org/UsedCondition",
    good: "https://schema.org/UsedCondition",
    fair: "https://schema.org/UsedCondition",
    for_parts: "https://schema.org/DamagedCondition",
  };
  return map[condition] || "https://schema.org/UsedCondition";
}

function buildJsonLd(post: any): object | null {
  if (post.type !== "marketplace" || !post.marketplace) return null;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: post.title,
    description: post.description || buildAutoDescription(post),
    image: post.images?.[0]?.fullUrl || post.images?.[0]?.url || undefined,
    url: `${SITE_URL}/posts/${post.id}`,
    offers: {
      "@type": "Offer",
      price: post.marketplace.priceType === "free" ? "0" : (post.marketplace.priceAmount ?? 0).toString(),
      priceCurrency: "USD",
      itemCondition: buildConditionUrl(post.marketplace.condition),
      availability: post.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    },
    seller: {
      "@type": "Person",
      name: post.author?.name,
    },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);

  if (!post) return { title: "Post Not Found" };

  const title = post.title;
  const description = post.description?.slice(0, 160) || buildAutoDescription(post);
  const image = post.images?.[0]?.thumbUrl || post.images?.[0]?.url || "/og-default.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
      type: "article",
    },
    alternates: {
      canonical: `/posts/${id}`,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const post = await fetchPost(id);
  const jsonLd = post ? buildJsonLd(post) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PostDetailPage />
    </>
  );
}
