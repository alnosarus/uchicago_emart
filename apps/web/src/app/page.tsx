"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface PostCard {
  id: string;
  title: string;
  type: string;
  side: string;
  createdAt: string;
  author: { name: string };
  marketplace: { priceType: string; priceAmount: number | null; condition: string; category: string } | null;
  storage: { size: string; priceMonthly: number | null; isFree: boolean } | null;
  housing: { monthlyRent: number | null; subtype: string } | null;
  images: { url: string }[];
}

export default function Home() {
  const { user, isLoading, logout } = useAuth();
  const [recentPosts, setRecentPosts] = useState<PostCard[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/posts?limit=6`)
      .then(r => r.ok ? r.json() : { posts: [] })
      .then(data => setRecentPosts(data.posts || []))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
          <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Marketplace
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/browse" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
            Browse
          </Link>
          {isLoading ? (
            <div className="w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
          ) : user ? (
            <>
              <Link href="/create" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                + Post
              </Link>
              <Link href="/notifications" className="text-xl px-2 py-1 rounded-full hover:bg-gray-100 transition-colors">
                🔔
              </Link>
              <button
                onClick={logout}
                className="text-sm font-semibold text-gray-700 border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                Log Out
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold">
                {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth" className="text-sm font-semibold text-gray-700 border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors">
                Log In
              </Link>
              <Link href="/auth" className="text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-4 py-2 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-maroon-900 via-maroon-700 to-maroon-500 px-8 py-24 text-center relative overflow-hidden">
        <h1 className="text-5xl font-black text-white mb-9 relative z-10">
          UChicago Marketplace
        </h1>
        <div className="max-w-xl mx-auto flex bg-white rounded-full shadow-2xl overflow-hidden p-1.5 pl-6 gap-2 items-center relative z-10">
          <span className="text-gray-400 text-lg">&#128269;</span>
          <input
            type="text"
            placeholder="Search listings, storage..."
            className="flex-1 border-none text-base text-gray-800 bg-transparent outline-none"
          />
          <button className="bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-6 py-2.5 rounded-full shadow-md">
            Browse
          </button>
        </div>
      </section>

      {/* Feature tabs */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-16 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-8 flex gap-0">
          <button className="px-6 py-3.5 text-sm font-bold text-maroon-700 border-b-3 border-maroon-600 -mb-0.5">
            Marketplace
          </button>
          <button className="px-6 py-3.5 text-sm font-bold text-gray-500 border-b-3 border-transparent hover:text-amber-700">
            Storage Match
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">Marketplace</h2>
            <p className="text-sm text-gray-500 mt-0.5">Buy and sell items with fellow Maroons</p>
          </div>
          <Link href="/create" className="bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-md">
            + Post Item
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
                    <span className="text-gray-300 text-4xl">&#128247;</span>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-gray-900 text-sm truncate">{post.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{post.author.name}</p>
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
        &copy; 2026 UChicago Marketplace &middot; Made for Maroons, by Maroons
      </footer>
    </>
  );
}
