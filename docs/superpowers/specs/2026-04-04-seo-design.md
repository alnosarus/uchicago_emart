# SEO — Design Spec

## Overview

Full SEO implementation for the UChicago Marketplace web app (Next.js 16, App Router). Covers server-side metadata for social sharing previews and Google discoverability, sitemap, robots.txt, JSON-LD structured data, and canonical URLs.

## Decisions

| Decision | Choice |
|----------|--------|
| Canonical domain | `https://www.uchicagoemart.com` |
| Social preview image | Post's cover image (first image thumbUrl), fallback to branded banner |
| Indexed pages | Home, Browse, Post Detail, User Profiles |
| No-index pages | Auth, Create, Edit, Saved, History, Verify |
| Metadata approach | Server component wrappers with `generateMetadata` for dynamic pages |

## 1. Core Metadata Architecture

### Problem

All pages are `"use client"` components. `generateMetadata` requires server components.

### Solution

For pages needing dynamic metadata (post detail, profile), create a server component wrapper:

```
page.tsx (server component)
  → exports generateMetadata() — fetches minimal data for title/description/image
  → renders <ClientPage /> — the existing interactive UI
```

The existing page code moves into a client component file (e.g. `client-page.tsx`), and `page.tsx` becomes a thin server wrapper.

### Root Layout Base Metadata

In `apps/web/src/app/layout.tsx`, export base metadata:

```typescript
export const metadata: Metadata = {
  metadataBase: new URL("https://www.uchicagoemart.com"),
  title: {
    default: "UChicago Marketplace — Buy, Sell & Find Housing with Fellow Maroons",
    template: "%s | UChicago Marketplace",
  },
  description: "The marketplace for UChicago students. Buy and sell textbooks, electronics, furniture, find storage, and housing — all within the Maroon community.",
  openGraph: {
    type: "website",
    siteName: "UChicago Marketplace",
    locale: "en_US",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "UChicago Marketplace" }],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

A default OG image (`public/og-default.png`, 1200x630) with the UChicago Marketplace branding.

## 2. Per-Page Metadata

### Post Detail (`/posts/[id]`)

Server-side `generateMetadata` fetches the post from the API:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await fetch(`${API_URL}/api/posts/${id}`).then(r => r.json());

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
```

`buildAutoDescription` generates a description from post type, category, price, and condition (e.g. "Electronics for sale — Like New, $25.00. Browse more on UChicago Marketplace.").

JSON-LD structured data (`Product` schema):
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Organic Chemistry Textbook",
  "description": "...",
  "image": "https://storage.googleapis.com/...",
  "offers": {
    "@type": "Offer",
    "price": "25.00",
    "priceCurrency": "USD",
    "itemCondition": "https://schema.org/UsedCondition",
    "availability": "https://schema.org/InStock"
  },
  "seller": {
    "@type": "Person",
    "name": "Alex Noh"
  }
}
```

### Browse (`/browse`)

Static metadata — no server fetch needed:

```typescript
export const metadata: Metadata = {
  title: "Browse Listings",
  description: "Browse marketplace, storage, and housing listings from UChicago students.",
  alternates: { canonical: "/browse" },
};
```

### User Profile (`/profile/[id]`)

Server-side `generateMetadata` fetches the user:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await fetch(`${API_URL}/api/users/${id}`).then(r => r.json());
  return {
    title: user.name,
    description: `${user.name}'s profile on UChicago Marketplace — view their listings and reviews.`,
    openGraph: {
      title: user.name,
      images: user.avatarUrl ? [{ url: user.avatarUrl }] : undefined,
    },
    alternates: { canonical: `/profile/${id}` },
  };
}
```

### Home (`/`)

Static metadata (set in root layout's default). JSON-LD `WebSite` schema with `SearchAction`:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "UChicago Marketplace",
  "url": "https://www.uchicagoemart.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://www.uchicagoemart.com/browse?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

### No-Index Pages

Auth, Create, Edit, Saved, History, Verify — each gets:

```typescript
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

## 3. Sitemap, Robots, and Crawlability

### `robots.ts`

```typescript
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/browse", "/posts/", "/profile/"],
        disallow: ["/auth", "/create", "/saved", "/history", "/posts/*/edit"],
      },
    ],
    sitemap: "https://www.uchicagoemart.com/sitemap.xml",
  };
}
```

### `sitemap.ts`

Dynamic sitemap that fetches active posts and users from the API:

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetch(`${API_URL}/api/posts?limit=1000`).then(r => r.json());

  const staticPages = [
    { url: "https://www.uchicagoemart.com", changeFrequency: "weekly", priority: 1.0 },
    { url: "https://www.uchicagoemart.com/browse", changeFrequency: "daily", priority: 0.9 },
  ];

  const postPages = posts.posts.map((post) => ({
    url: `https://www.uchicagoemart.com/posts/${post.id}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticPages, ...postPages];
}
```

### Canonical URLs

Each page sets `alternates.canonical` relative to `metadataBase`. Next.js resolves them to full URLs automatically.
