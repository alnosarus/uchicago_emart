"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface TransactionItem {
  id: string;
  postId: string;
  completedAt: string;
  role: "seller" | "buyer";
  counterparty: {
    id: string;
    name: string;
    cnetId: string;
    avatarUrl: string | null;
  };
  post: {
    id: string;
    title: string;
    type: string;
    side: string;
    images?: { url: string }[];
  };
}

function roleLabel(role: string, postType: string): string {
  if (postType === "marketplace") return role === "seller" ? "Sold" : "Bought";
  if (postType === "storage") return role === "seller" ? "Provided storage" : "Stored with";
  if (postType === "housing") return role === "seller" ? "Sublet/passed down" : "Rented from";
  return role === "seller" ? "Completed" : "Participated";
}

function roleBadgeColor(role: string): string {
  return role === "seller"
    ? "bg-green-50 text-green-700"
    : "bg-blue-50 text-blue-700";
}

function typeColor(type: string): string {
  if (type === "marketplace") return "text-maroon-600";
  if (type === "storage") return "text-amber-600";
  if (type === "housing") return "text-indigo-600";
  return "text-gray-600";
}

export default function HistoryPage() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/transactions/history?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data || []);
        setTotal(data.total || 0);
      }
    } catch {
      // Ignore fetch errors
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }
    fetchHistory();
  }, [authLoading, user, fetchHistory, router]);

  const totalPages = Math.ceil(total / 20);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="text-xl sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
          <span className="hidden sm:inline text-sm font-medium text-gray-400 uppercase tracking-wider">
            Marketplace
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/browse" className="text-sm font-medium text-gray-600 hover:text-maroon-600 px-2 sm:px-3 py-1.5 rounded-md transition-colors">
            Browse
          </Link>
          {user && (
            <>
              <Link href="/create" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                + Post
              </Link>
              <Link href="/saved" className="hidden sm:inline-flex text-sm font-medium text-gray-600 hover:text-maroon-600 px-3 py-1.5 rounded-md transition-colors">
                Saved
              </Link>
              <Link href="/history" className="text-sm font-semibold text-maroon-600 px-2 sm:px-3 py-1.5 rounded-md">
                History
              </Link>
              <Link href={`/profile/${user.id}`} className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Transaction History</h1>
        <p className="text-sm text-gray-500 mb-6">
          {total} completed {total === 1 ? "transaction" : "transactions"}
        </p>

        {transactions.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg text-gray-400 mb-2">No transactions yet</p>
            <p className="text-sm text-gray-400 mb-4">
              When you buy or sell something, it will show up here
            </p>
            <Link href="/browse" className="text-maroon-600 font-medium hover:underline">
              Browse listings
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn) => (
              <Link
                key={txn.id}
                href={`/posts/${txn.post.id}`}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                {/* Post thumbnail */}
                <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {txn.post.images?.[0] ? (
                    <img
                      src={txn.post.images[0].url}
                      alt={txn.post.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      No img
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {txn.post.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    with{" "}
                    <span className="font-medium text-gray-700">
                      {txn.counterparty.name}
                    </span>{" "}
                    <span className="text-gray-400">@{txn.counterparty.cnetId}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(txn.completedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                {/* Badges */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeColor(txn.role)}`}>
                    {roleLabel(txn.role, txn.post.type)}
                  </span>
                  <span className={`text-xs font-medium capitalize ${typeColor(txn.post.type)}`}>
                    {txn.post.type}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm font-medium text-gray-600 hover:text-maroon-600 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm font-medium text-gray-600 hover:text-maroon-600 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
