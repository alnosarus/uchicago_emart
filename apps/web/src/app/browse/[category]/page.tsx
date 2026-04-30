import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const SITE_URL = "https://www.uchicagoemart.com";

// ── Category config ───────────────────────────────

interface CategoryConfig {
  label: string;
  h1: string;
  tagline: string;
  bodyText: string;
  apiType: string;
  apiCategory?: string;
  browseUrl: string;
  metaTitle: string;
  metaDescription: string;
}

const CATEGORIES: Record<string, CategoryConfig> = {
  textbooks: {
    label: "Textbooks",
    h1: "Buy & Sell Textbooks at UChicago",
    tagline: "Course materials from verified UChicago students",
    bodyText:
      "Skip the campus bookstore. Find used textbooks directly from UChicago students at a fraction of the retail price. Every seller is verified with a @uchicago.edu email — browse by course, condition, or price and save on every quarter's reading list.",
    apiType: "marketplace",
    apiCategory: "Textbooks",
    browseUrl: "/browse?type=marketplace&category=Textbooks",
    metaTitle: "Buy & Sell Textbooks at UChicago",
    metaDescription:
      "Find used textbooks from UChicago students near Hyde Park. Save on course materials each quarter from verified @uchicago.edu sellers.",
  },
  electronics: {
    label: "Electronics",
    h1: "UChicago Electronics Marketplace",
    tagline: "Laptops, tablets, and more from fellow Maroons",
    bodyText:
      "Buy and sell electronics with verified UChicago students. Find laptops, tablets, calculators, and other tech at student-friendly prices near Hyde Park. All sellers are verified UChicago community members.",
    apiType: "marketplace",
    apiCategory: "Electronics",
    browseUrl: "/browse?type=marketplace&category=Electronics",
    metaTitle: "UChicago Electronics — Buy & Sell Near Hyde Park",
    metaDescription:
      "Buy and sell electronics with UChicago students. Find laptops, tablets, and tech gear at student prices near Hyde Park.",
  },
  furniture: {
    label: "Furniture",
    h1: "UChicago Student Furniture",
    tagline: "Affordable furniture from students moving in and out",
    bodyText:
      "Furnish your off-campus apartment or dorm room without breaking the bank. UChicago students list desks, chairs, beds, and more — especially around move-in and graduation season. All listings are from verified Hyde Park community members.",
    apiType: "marketplace",
    apiCategory: "Furniture",
    browseUrl: "/browse?type=marketplace&category=Furniture",
    metaTitle: "Buy & Sell Furniture at UChicago | Hyde Park",
    metaDescription:
      "Find affordable furniture from UChicago students. Desks, chairs, beds, and more near Hyde Park — perfect for off-campus housing.",
  },
  clothing: {
    label: "Clothing",
    h1: "UChicago Student Clothing Marketplace",
    tagline: "Pre-loved clothing from fellow Maroons",
    bodyText:
      "Shop or sell pre-loved clothing with UChicago students. From everyday essentials to formal wear, find great deals from verified community members on campus and near Hyde Park.",
    apiType: "marketplace",
    apiCategory: "Clothing",
    browseUrl: "/browse?type=marketplace&category=Clothing",
    metaTitle: "Buy & Sell Clothing at UChicago",
    metaDescription:
      "Shop pre-loved clothing from UChicago students. Find great deals on everything from casual wear to formal attire near Hyde Park.",
  },
  housing: {
    label: "Housing & Sublets",
    h1: "UChicago Student Housing & Sublets",
    tagline: "Sublets and lease passdowns near Hyde Park",
    bodyText:
      "Find short-term sublets and long-term lease passdowns from UChicago students. All listings are posted by verified @uchicago.edu users — perfect for study abroad departures, summer breaks, or incoming students looking for housing near campus.",
    apiType: "housing",
    browseUrl: "/browse?type=housing",
    metaTitle: "UChicago Student Housing & Sublets Near Hyde Park",
    metaDescription:
      "Find UChicago sublets and lease passdowns near Hyde Park. Short-term and long-term housing from verified University of Chicago students.",
  },
  storage: {
    label: "Student Storage",
    h1: "UChicago Student Storage Matching",
    tagline: "Connect with storage hosts near campus",
    bodyText:
      "Store your belongings with a fellow Maroon over break or between moves. UChicago E-mart matches students who need storage space with those who have it — on and off campus, all verified with a @uchicago.edu email.",
    apiType: "storage",
    browseUrl: "/browse?type=storage",
    metaTitle: "UChicago Student Storage Near Hyde Park",
    metaDescription:
      "Find student storage near UChicago. Connect with verified @uchicago.edu hosts offering space on and off campus in Hyde Park.",
  },
  sports: {
    label: "Sports Equipment",
    h1: "UChicago Sports Equipment Marketplace",
    tagline: "Gear up from fellow Maroons",
    bodyText:
      "Buy and sell sports and fitness equipment with UChicago students. From bikes to weights to tennis rackets — find gear at student prices from verified community members near Hyde Park.",
    apiType: "marketplace",
    apiCategory: "Sports",
    browseUrl: "/browse?type=marketplace&category=Sports",
    metaTitle: "Buy & Sell Sports Equipment at UChicago",
    metaDescription:
      "Find sports and fitness equipment from UChicago students. Bikes, weights, and more at student prices near Hyde Park.",
  },
  music: {
    label: "Music Instruments",
    h1: "UChicago Music Instruments Marketplace",
    tagline: "Find instruments from fellow musicians at UChicago",
    bodyText:
      "Buy and sell musical instruments with UChicago students. Whether you're looking for a guitar, keyboard, or sheet music, find it from a verified Maroon at a fair price.",
    apiType: "marketplace",
    apiCategory: "Music",
    browseUrl: "/browse?type=marketplace&category=Music",
    metaTitle: "Buy & Sell Music Instruments at UChicago",
    metaDescription:
      "Find musical instruments from UChicago students. Guitars, keyboards, and more from verified @uchicago.edu sellers.",
  },
};

// ── Types ─────────────────────────────────────────

interface CategoryPost {
  id: string;
  title: string;
  type: string;
  side: string;
  author: { name: string };
  marketplace: { priceType: string; priceAmount: number | null } | null;
  storage: { priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null; subtype: string } | null;
  images: { url: string; thumbUrl: string | null }[];
}

// ── Helpers ───────────────────────────────────────

function formatPrice(post: CategoryPost): string {
  if (post.marketplace) {
    if (post.marketplace.priceType === "free") return "Free";
    if (post.marketplace.priceType === "trade") return "Negotiable";
    if (post.marketplace.priceAmount != null)
      return `$${post.marketplace.priceAmount.toFixed(2)}`;
  }
  if (post.storage) {
    if (post.storage.isFree) return "Free";
    if (post.storage.priceMonthly != null)
      return `$${post.storage.priceMonthly.toFixed(2)}/mo`;
  }
  if (post.housing?.monthlyRent != null)
    return `$${post.housing.monthlyRent.toFixed(2)}/mo`;
  return "";
}

// ── Static post card (no client hooks needed) ─────

function StaticPostCard({ post }: { post: CategoryPost }) {
  const price = formatPrice(post);
  const image = post.images[0];
  const badge =
    post.type === "storage"
      ? { label: "Storage", cls: "bg-amber-100 text-amber-700" }
      : post.type === "housing"
      ? {
          label: post.housing?.subtype === "sublet" ? "Sublet" : "Passdown",
          cls: "bg-indigo-100 text-indigo-700",
        }
      : post.side === "buy"
      ? { label: "Buying", cls: "bg-blue-100 text-blue-700" }
      : { label: "Selling", cls: "bg-green-100 text-green-700" };

  return (
    <Link
      href={`/posts/${post.id}`}
      className="group block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {image ? (
          <img
            src={image.thumbUrl || image.url}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
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
        <div className="absolute top-2 left-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
      </div>
      <div className="p-3.5">
        {price && (
          <span
            className={`inline-block text-sm font-bold mb-1.5 px-2 py-0.5 rounded ${
              price === "Free" ? "bg-green-100 text-green-700" : "bg-maroon-100 text-maroon-700"
            }`}
          >
            {price}
          </span>
        )}
        <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-maroon-700 transition-colors">
          {post.title}
        </h3>
        <p className="text-xs text-gray-500 mt-1.5">{post.author.name}</p>
      </div>
    </Link>
  );
}

// ── Data fetching ─────────────────────────────────

async function fetchCategoryPosts(config: CategoryConfig): Promise<CategoryPost[]> {
  const params = new URLSearchParams();
  params.set("type", config.apiType);
  if (config.apiCategory) params.set("category", config.apiCategory);
  params.set("limit", "12");

  try {
    const res = await fetch(`${API_URL}/api/posts?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts ?? [];
  } catch {
    return [];
  }
}

// ── Next.js exports ───────────────────────────────

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const config = CATEGORIES[category];
  if (!config) return { title: "Not Found" };
  return {
    title: config.metaTitle,
    description: config.metaDescription,
    alternates: { canonical: `${SITE_URL}/browse/${category}` },
    openGraph: {
      title: config.metaTitle,
      description: config.metaDescription,
      type: "website",
    },
  };
}

export function generateStaticParams() {
  return Object.keys(CATEGORIES).map((category) => ({ category }));
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const config = CATEGORIES[category];
  if (!config) notFound();

  const posts = await fetchCategoryPosts(config);

  return (
    <>
      <Navbar />

      {/* Header */}
      <div className="bg-[#800000] py-10 pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <nav className="text-maroon-300 text-xs mb-3 flex items-center gap-1">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/browse" className="hover:text-white transition-colors">Browse</Link>
            <span>/</span>
            <span className="text-white">{config.label}</span>
          </nav>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{config.h1}</h1>
          <p className="text-maroon-200 text-sm">{config.tagline}</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        {/* SEO body text */}
        <p className="text-gray-600 text-sm mb-8 max-w-2xl leading-relaxed">{config.bodyText}</p>

        {posts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {posts.map((post) => (
                <StaticPostCard key={post.id} post={post} />
              ))}
            </div>
            <div className="text-center">
              <Link
                href={config.browseUrl}
                className="inline-flex items-center gap-2 px-6 py-3 bg-maroon-600 text-white text-sm font-semibold rounded-full hover:bg-maroon-700 transition-colors shadow-sm"
              >
                Browse all {config.label}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No listings yet in this category.</p>
            <Link
              href={config.browseUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-maroon-600 text-white text-sm font-semibold rounded-full hover:bg-maroon-700 transition-colors"
            >
              Browse all {config.label}
            </Link>
          </div>
        )}
      </main>
    </>
  );
}
