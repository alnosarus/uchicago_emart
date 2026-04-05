"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { MessageBell } from "@/components/MessageBell";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { useState, useEffect, useRef, useCallback } from "react";

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
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [recentPosts, setRecentPosts] = useState<PostCard[]>([]);
  const [activeTab, setActiveTab] = useState("marketplace");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
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
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {isLoading ? (
            <div className="w-16 sm:w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
            <>
              <Link href="/create" className="flex items-center gap-1.5 bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-sm hover:from-maroon-700 hover:to-maroon-800 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Post
              </Link>
              <NotificationBell />
              <MessageBell />
              {/* Avatar + dropdown */}
              <div className="relative">
                {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}
                <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-full overflow-hidden shrink-0 relative z-50">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold">
                      {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                    </div>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                    <Link href={`/profile/${user.id}`} onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                      Profile
                    </Link>
                    <Link href="/saved" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
                      Saved
                    </Link>
                    <Link href="/history" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      History
                    </Link>
                    <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                      Notifications
                    </Link>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" /></svg>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth" className="hidden sm:inline-flex text-sm font-semibold text-gray-700 border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors">
                Log In
              </Link>
              <Link href="/auth" className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-maroon-900 via-maroon-700 to-maroon-500 px-4 sm:px-8 py-14 sm:py-24 text-center relative overflow-hidden">
        <img src="/images/phoenix.png" alt="" aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-full w-auto opacity-15 pointer-events-none select-none" />
        <h1 className="mb-3 sm:mb-4 relative z-10">
          <span className="block text-3xl sm:text-4xl md:text-5xl font-bold tracking-[.18em] uppercase opacity-85 text-white/70 mb-1" style={{ fontFamily: "'Oswald', sans-serif" }}>UChicago</span>
          <span className="block text-5xl sm:text-6xl md:text-7xl font-light tracking-[.2em] uppercase text-white" style={{ fontFamily: "'Raleway', sans-serif" }}>E-mart</span>
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
          }}
          className="max-w-xl mx-auto flex bg-white rounded-full shadow-2xl p-1 sm:p-1.5 pl-4 sm:pl-6 gap-1.5 sm:gap-2 items-center relative z-10"
        >
          <svg className="w-5 h-5 shrink-0 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
          <SearchAutocomplete
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={(q) => router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse")}
            placeholder="Search listings, storage..."
            inputClassName="flex-1 border-none text-sm sm:text-base text-gray-800 bg-transparent outline-none min-w-0"
          />
          <button type="submit" className="bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-xs sm:text-sm font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-md shrink-0">
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
