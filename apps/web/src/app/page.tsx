"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

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

  useEffect(() => {
    fetch(`${API_URL}/api/posts?type=${activeTab}&limit=6`)
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(data => setRecentPosts(data.posts || []))
      .catch(() => {});
  }, [activeTab]);

  return (
    <>
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/browse" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-2 sm:px-3 py-1.5 rounded-md transition-colors">
            Browse
          </Link>
          {isLoading ? (
            <div className="w-16 sm:w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
            <>
              <Link href="/create" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                + Post
              </Link>
              <Link href="/saved" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                Saved
              </Link>
              <Link href="/history" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                History
              </Link>
              <Link href="/notifications" className="px-1.5 sm:px-2 py-1 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center">
                <img src="/icons/bell.png" alt="Notifications" className="w-5 h-5 sm:w-6 sm:h-6" />
              </Link>
              <button
                onClick={logout}
                className="hidden sm:inline-flex text-sm font-semibold text-gray-700 border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                Log Out
              </button>
              <Link href={`/profile/${user.id}`} className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </Link>
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
        <h1 className="text-white mb-3 sm:mb-4 relative z-10">
          <span className="block text-5xl sm:text-6xl md:text-7xl font-bold tracking-[.18em] uppercase" style={{ fontFamily: "'Oswald', sans-serif" }}>UChicago</span>
          <span className="block text-3xl sm:text-4xl md:text-5xl font-light tracking-[.2em] uppercase opacity-85 mt-3 sm:mt-4" style={{ fontFamily: "'Raleway', sans-serif" }}>E-mart</span>
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = searchQuery.trim();
            router.push(q ? `/browse?q=${encodeURIComponent(q)}` : "/browse");
          }}
          className="max-w-xl mx-auto flex bg-white rounded-full shadow-2xl overflow-hidden p-1 sm:p-1.5 pl-4 sm:pl-6 gap-1.5 sm:gap-2 items-center relative z-10"
        >
          <img src="/icons/search.png" alt="" className="w-4 h-4 sm:w-5 sm:h-5 opacity-40 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search listings, storage..."
            className="flex-1 border-none text-sm sm:text-base text-gray-800 bg-transparent outline-none min-w-0"
          />
          <button type="submit" className="bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-xs sm:text-sm font-semibold px-4 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-md shrink-0">
            Browse
          </button>
        </form>
      </section>

      {/* Feature tabs */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-14 sm:top-16 z-40 shadow-sm overflow-x-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 flex gap-0 min-w-max sm:min-w-0">
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
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">
              {activeTab === "marketplace" ? "Marketplace" : activeTab === "storage" ? "Storage Match" : "Housing"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeTab === "marketplace" ? "Buy and sell items with fellow Maroons" : activeTab === "storage" ? "Find or offer storage space" : "Sublets and passdowns for Maroons"}
            </p>
          </div>
          <Link href="/create" className="bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md">
            + Post
          </Link>
        </div>
        {recentPosts.length > 0 ? (
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
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-400">{user ? "No posts yet. Be the first to list something!" : "Sign in to start buying and selling with fellow Maroons."}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-500 text-center py-6 text-sm mt-auto">
        &copy; 2026 UChicago E-mart &middot; Made for Maroons, by Maroons
      </footer>
    </>
  );
}
