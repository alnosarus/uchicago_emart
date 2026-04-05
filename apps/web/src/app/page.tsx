"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PostCard {
  id: string;
  title: string;
  type: string;
  side: string;
  createdAt: string;
  author: { id: string; name: string };
  marketplace: { priceType: string; priceAmount: number | null; condition: string; category: string } | null;
  storage: { size: string; priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null; subtype: string } | null;
  images: { url: string }[];
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentPosts, setRecentPosts] = useState<PostCard[]>([]);
  const [activeTab, setActiveTab] = useState("marketplace");
  const [searchQuery, setSearchQuery] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when tab changes
  useEffect(() => {
    setRecentPosts([]);
    setPage(1);
    setHasMore(true);
  }, [activeTab]);

  // Fetch posts
  useEffect(() => {
    let cancelled = false;
    const isFirstPage = page === 1;
    if (isFirstPage) setLoadingMore(false);
    else setLoadingMore(true);

    fetch(`${API_URL}/api/posts?type=${activeTab}&limit=12&page=${page}`)
      .then(r => r.ok ? r.json() : { posts: [], pagination: { page: 1, totalPages: 1 } })
      .then(data => {
        if (cancelled) return;
        if (isFirstPage) {
          setRecentPosts(data.posts || []);
        } else {
          setRecentPosts(prev => [...prev, ...(data.posts || [])]);
        }
        setHasMore(data.pagination ? data.pagination.page < data.pagination.totalPages : false);
        setLoadingMore(false);
      })
      .catch(() => { if (!cancelled) setLoadingMore(false); });

    return () => { cancelled = true; };
  }, [activeTab, page]);

  // IntersectionObserver
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loadingMore]);

  return (
    <>
      {/* Navbar */}
      <Navbar />

      {/* Hero */}
      <section className="bg-[#800000] px-4 sm:px-8 py-14 sm:py-24 text-center relative overflow-hidden group">
        <img src="/images/phoenix.png" alt="" aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-auto pointer-events-none select-none opacity-0 group-hover:opacity-15 transition-opacity duration-700" />
        <div className="mb-6 sm:mb-8 flex justify-center relative z-10">
          <img src="/logos/logo-white.svg" alt="UChicago E-mart" className="h-24 sm:h-28" />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
          }}
          className="max-w-xl mx-auto flex bg-white rounded-full shadow-2xl p-1 sm:p-1.5 pl-4 sm:pl-6 gap-1.5 sm:gap-2 items-center text-left relative z-10"
        >
          <svg className="w-5 h-5 shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <SearchAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={(q) => router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse")}
            placeholder="Search listings, storage..."
            inputClassName="flex-1 border-none text-sm sm:text-base text-gray-800 bg-transparent outline-none min-w-0 text-left"
          />
          <button type="submit" className="bg-[#800000] text-white text-xs sm:text-sm font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-md shrink-0">
            Browse
          </button>
        </form>
      </section>

      {/* Feature tabs */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-14 sm:top-16 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex gap-0">
          {[
            { label: "Marketplace", value: "marketplace", activeColor: "text-maroon-700 border-maroon-600", hoverColor: "hover:text-maroon-600" },
            { label: "Storage", value: "storage", activeColor: "text-amber-700 border-amber-600", hoverColor: "hover:text-amber-700" },
            { label: "Housing", value: "housing", activeColor: "text-indigo-700 border-indigo-600", hoverColor: "hover:text-indigo-700" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 sm:px-6 py-3 sm:py-3.5 text-sm font-bold border-b-3 -mb-0.5 transition-colors whitespace-nowrap ${
                activeTab === tab.value
                  ? tab.activeColor
                  : `text-gray-500 border-transparent ${tab.hoverColor}`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">
              {activeTab === "marketplace" ? "Marketplace" : activeTab === "storage" ? "Storage Match" : "Housing"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeTab === "marketplace" ? "Buy and sell items with fellow Maroons" : activeTab === "storage" ? "Find or offer storage space" : "Sublets and passdowns for Maroons"}
            </p>
          </div>
        </div>
        {recentPosts.length > 0 ? (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentPosts.map(post => (
              <Link key={post.id} href={`/posts/${post.id}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-40 bg-gray-100 flex items-center justify-center">
                  {post.images[0] ? (
                    <img src={post.images[0].url} alt={post.title} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-gray-900 text-sm truncate">{post.title}</p>
                  <Link
                    href={`/profile/${post.author.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-gray-500 mt-1 hover:text-maroon-600 transition-colors block"
                  >
                    {post.author.name}
                  </Link>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-maroon-700">
                      {post.marketplace?.priceType === "free" || post.storage?.isFree
                        ? "Free"
                        : post.marketplace?.priceAmount
                        ? `$${post.marketplace.priceAmount}`
                        : post.storage?.priceMonthly
                        ? `$${post.storage.priceMonthly}/mo`
                        : post.housing?.monthlyRent
                        ? `$${post.housing.monthlyRent}/mo`
                        : "Contact"}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{post.type}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400">{user ? "No posts yet. Be the first to list something!" : "Sign in to start buying and selling with fellow Maroons."}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-500 text-center py-6 text-sm mt-auto">
        <p>&copy; 2026 UChicago E-mart &middot; Made for Maroons, by Maroons</p>
        <p className="mt-2">
          <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy Policy</Link>
          {" · "}
          <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms of Service</Link>
        </p>
      </footer>
    </>
  );
}
