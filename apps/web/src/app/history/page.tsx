"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Suspense } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface TransactionItem {
  id: string;
  postId: string;
  completedAt: string;
  role: "seller" | "buyer";
  hasReviewed: boolean;
  myRating: number | null;
  revieweeId: string;
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

// ── Star rating picker ────────────────────────────

const STAR_PATH = "M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z";

// Renders a single star: full, half, or empty.
function Star({ fill, size = "w-5 h-5", dimmed = false }: { fill: "full" | "half" | "empty"; size?: string; dimmed?: boolean }) {
  const id = `half-${Math.random().toString(36).slice(2)}`;
  if (fill === "full") {
    return (
      <svg className={`${size} text-amber-400`} fill="currentColor" viewBox="0 0 20 20">
        <path d={STAR_PATH} />
      </svg>
    );
  }
  if (fill === "empty") {
    return (
      <svg className={`${size} ${dimmed ? "text-gray-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
        <path d={STAR_PATH} />
      </svg>
    );
  }
  // Half star: left half amber, right half gray via SVG clipPath
  return (
    <svg className={size} viewBox="0 0 20 20" fill="none">
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width="10" height="20" />
        </clipPath>
      </defs>
      {/* Gray base */}
      <path d={STAR_PATH} fill={dimmed ? "#9ca3af" : "#e5e7eb"} />
      {/* Amber left half */}
      <path d={STAR_PATH} fill="#fbbf24" clipPath={`url(#${id})`} />
    </svg>
  );
}

function starFill(pos: number, active: number): "full" | "half" | "empty" {
  if (active >= pos) return "full";
  if (active >= pos - 0.5) return "half";
  return "empty";
}

function StarPicker({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  const isHovering = hover > 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>, pos: number) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHover(x < rect.width / 2 ? pos - 0.5 : pos);
  };

  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(hover || s)}
          onMouseMove={(e) => handleMouseMove(e, s)}
          onMouseLeave={() => !readOnly && setHover(0)}
          className={readOnly ? "cursor-default" : "cursor-pointer"}
          aria-label={`${hover || s} stars`}
        >
          <Star
            fill={starFill(s, active)}
            dimmed={isHovering && s > active}
          />
        </button>
      ))}
    </span>
  );
}

// ── Rating modal ──────────────────────────────────

function RatingModal({
  txn,
  accessToken,
  onClose,
  onSubmitted,
}: {
  txn: TransactionItem;
  accessToken: string;
  onClose: () => void;
  onSubmitted: (rating: number) => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { setError("Please select a star rating."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          postId: txn.postId,
          revieweeId: txn.revieweeId,
          rating,
          text: text.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Failed to submit review.");
        return;
      }
      onSubmitted(rating);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Rate this transaction</h2>
            <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{txn.post.title}</p>
          </div>
          <button onClick={onClose} className="ml-3 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-sm font-medium text-gray-700">
              Rating for <span className="text-gray-900">{txn.counterparty.name}</span>
            </p>
            <StarPicker value={rating} onChange={setRating} />
            {rating > 0 && (
              <p className="text-xs text-gray-400">
                {rating === 0.5 ? "0.5 – Poor" :
                 rating === 1 ? "1 – Poor" :
                 rating === 1.5 ? "1.5 – Poor" :
                 rating === 2 ? "2 – Fair" :
                 rating === 2.5 ? "2.5 – Fair" :
                 rating === 3 ? "3 – Good" :
                 rating === 3.5 ? "3.5 – Good" :
                 rating === 4 ? "4 – Very Good" :
                 rating === 4.5 ? "4.5 – Very Good" :
                 "5 – Excellent"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Comment <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Describe your experience..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-0.5 text-right">{text.length}/500</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <strong>Note:</strong> Reviews cannot be changed once submitted.{" "}
            <Link href="/terms" target="_blank" className="underline hover:text-amber-900">
              See our Terms of Service
            </Link>{" "}
            to learn more.
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="flex-1 text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-4 py-2 rounded-full shadow hover:from-maroon-700 hover:to-maroon-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Transaction row ───────────────────────────────

function TransactionRow({
  txn,
  accessToken,
  onReviewed,
}: {
  txn: TransactionItem;
  accessToken: string;
  onReviewed: (postId: string, rating: number) => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="group flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        {/* Thumbnail — links to post */}
        <Link href={`/posts/${txn.post.id}`} className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 block">
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
        </Link>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link href={`/posts/${txn.post.id}`} className="font-semibold text-gray-900 text-sm truncate block hover:text-maroon-700 transition-colors">
            {txn.post.title}
          </Link>
          <p className="text-xs text-gray-500 mt-1">
            with{" "}
            <Link href={`/profile/${txn.counterparty.id}`} className="font-medium text-gray-700 hover:text-maroon-600 transition-colors">
              {txn.counterparty.name}
            </Link>{" "}
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

        {/* Right side: badges + stars */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadgeColor(txn.role)}`}>
            {roleLabel(txn.role, txn.post.type)}
          </span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${typeBadgeColor(txn.post.type)}`}>
            {txn.post.type}
          </span>
          {/* Rating stars */}
          {txn.hasReviewed ? (
            <StarPicker value={txn.myRating ?? 0} readOnly />
          ) : (
            <button
              onClick={() => setShowModal(true)}
              className="group/stars flex items-center gap-1"
              title="Rate this transaction"
            >
              <StarPicker value={0} readOnly />
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <RatingModal
          txn={txn}
          accessToken={accessToken}
          onClose={() => setShowModal(false)}
          onSubmitted={(rating) => {
            setShowModal(false);
            onReviewed(txn.postId, rating);
          }}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────

function HistoryPageInner() {
  const { user, accessToken, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const withUserId = searchParams.get("with");

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [withName, setWithName] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const url = withUserId
        ? `${API_URL}/api/transactions/history?page=${page}&limit=20&with=${withUserId}`
        : `${API_URL}/api/transactions/history?page=${page}&limit=20`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.data || []);
        setTotal(data.total || 0);
        // Grab counterparty name from first result
        if (withUserId && data.data?.length > 0) {
          setWithName(data.data[0].counterparty.name);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, page, withUserId]);

  // Also fetch counterparty name if no transactions yet
  useEffect(() => {
    if (withUserId && !withName) {
      fetch(`${API_URL}/api/users/${withUserId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => { if (d?.name) setWithName(d.name); })
        .catch(() => {});
    }
  }, [withUserId, withName]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth");
      return;
    }
    fetchHistory();
  }, [authLoading, user, fetchHistory, router]);

  const handleReviewed = (postId: string, rating: number) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.postId === postId ? { ...t, hasReviewed: true, myRating: rating } : t
      )
    );
  };

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
      <Navbar />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10">
        <div className="mb-6">
          <div className="flex items-center gap-2">
            {withUserId && (
              <Link href="/history" className="text-sm text-gray-400 hover:text-maroon-600 transition-colors">
                ← All transactions
              </Link>
            )}
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mt-1">
            {withUserId && withName ? `Transactions with ${withName}` : "Transaction History"}
          </h1>
          {withUserId ? (
            <p className="text-sm text-gray-500 mt-1">
              Showing only transactions made with {withName ?? "this user"}.{" "}
              <span className="text-gray-400">You can only see transactions involving both of you.</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">
              {total} completed {total === 1 ? "transaction" : "transactions"}
            </p>
          )}
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
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  accessToken={accessToken!}
                  onReviewed={handleReviewed}
                />
              ))}
            </div>

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
            {withUserId ? (
              <>
                <p className="text-gray-500 font-medium">No transactions with {withName ?? "this user"}</p>
                <p className="text-gray-400 text-sm mt-1">You haven&apos;t completed any transactions together yet.</p>
                <Link
                  href="/history"
                  className="mt-4 inline-block text-sm font-semibold text-maroon-600 hover:underline"
                >
                  View all transactions
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500 font-medium">No transactions yet</p>
                <p className="text-gray-400 text-sm mt-1">When you buy or sell something, it will show up here</p>
                <Link
                  href="/browse"
                  className="mt-4 inline-block text-sm font-semibold text-white bg-gradient-to-br from-maroon-600 to-maroon-700 px-5 py-2 rounded-full shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all"
                >
                  Browse listings
                </Link>
              </>
            )}
          </div>
        )}
      </main>

      <footer className="bg-gray-900 text-gray-500 text-center py-6 text-sm mt-auto">
        &copy; 2026 UChicago E-mart &middot; Made for Maroons, by Maroons
      </footer>
    </>
  );
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryPageInner />
    </Suspense>
  );
}
