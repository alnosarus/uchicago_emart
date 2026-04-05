"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";

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
  return role === "seller" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
}

function typeBadgeColor(type: string): string {
  if (type === "storage") return "bg-amber-100 text-amber-700";
  if (type === "housing") return "bg-indigo-100 text-indigo-700";
  return "bg-maroon-100 text-maroon-700";
}

export default function HistoryPage() {
  const { user, accessToken, isLoading: authLoading, logout } = useAuth();
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
      // ignore
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

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Navbar */}
      <Navbar />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Transaction History</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} completed {total === 1 ? "transaction" : "transactions"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="h-5 w-14 bg-gray-200 rounded-full" />
                    <div className="h-4 w-20 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length > 0 ? (
          <>
            <div className="space-y-3">
              {transactions.map((txn) => (
                <Link
                  key={txn.id}
                  href={`/posts/${txn.post.id}`}
                  className="group flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                    {txn.post.images?.[0] ? (
                      <img
                        src={txn.post.images[0].url}
                        alt={txn.post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate group-hover:text-maroon-700 transition-colors">
                      {txn.post.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      with <span className="font-medium text-gray-700">{txn.counterparty.name}</span>{" "}
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
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadgeColor(txn.role)}`}>
                      {roleLabel(txn.role, txn.post.type)}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${typeBadgeColor(txn.post.type)}`}>
                      {txn.post.type}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

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
          </>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No transactions yet</p>
            <p className="text-gray-400 text-sm mt-1">When you buy or sell something, it will show up here</p>
            <Link
              href="/browse"
              className="mt-4 inline-block text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-5 py-2 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all"
            >
              Browse listings
            </Link>
          </div>
        )}
      </main>

      <footer className="bg-gray-900 text-gray-500 text-center py-6 text-sm mt-auto">
        &copy; 2026 UChicago E-mart &middot; Made for Maroons, by Maroons
      </footer>
    </>
  );
}
