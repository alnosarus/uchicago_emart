"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";
import { MessageBell } from "@/components/MessageBell";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Notification {
  id: string;
  type: "message" | "review" | "save" | "match" | "expiring" | "system";
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TYPE_ICONS: Record<string, string> = {
  review: "\u2B50",
  save: "\u2764\uFE0F",
  expiring: "\u23F0",
  system: "\uD83D\uDCE2",
  message: "\uD83D\uDCAC",
  match: "\uD83D\uDD17",
};

function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function NotificationsPage() {
  const { user, accessToken, isLoading, logout } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchNotifications = useCallback(async (page: number = 1) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications((prev) => page === 1 ? data.data : [...prev, ...data.data]);
      setPagination(data.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth");
      return;
    }
    if (accessToken) fetchNotifications();
  }, [isLoading, user, accessToken]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (!accessToken) return;
    if (!notification.isRead) {
      await fetch(`${API_URL}/api/notifications/${notification.id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!accessToken) return;
    await fetch(`${API_URL}/api/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleRenew = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}/renew`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.link === `/posts/${postId}` && n.type === "expiring"
              ? { ...n, body: n.body.replace("expires in 3 days. Renew it to keep it active.", "has been renewed!") }
              : n
          )
        );
      }
    } catch {
      // ignore
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-10 sm:h-11" />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              <Link href="/create" className="flex items-center gap-1.5 bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-sm hover:from-maroon-700 hover:to-maroon-800 transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                Post
              </Link>
              <NotificationBell />
              <MessageBell />
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
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm font-medium text-maroon-600 hover:text-maroon-700 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">{"\uD83D\uDD14"}</p>
            <p className="text-gray-500 font-medium">No notifications yet</p>
            <p className="text-sm text-gray-400 mt-1">We&apos;ll notify you when something happens</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const postId = notification.link?.match(/\/posts\/(.+)/)?.[1];
              return (
                <button
                  key={notification.id}
                  onClick={() => handleMarkAsRead(notification)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    notification.isRead
                      ? "bg-white border-gray-100 hover:bg-gray-50"
                      : "bg-maroon-50/50 border-maroon-100 hover:bg-maroon-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl mt-0.5">
                      {TYPE_ICONS[notification.type] || "\uD83D\uDD14"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className={`text-sm ${notification.isRead ? "font-medium text-gray-700" : "font-bold text-gray-900"}`}>
                          {notification.title}
                        </h3>
                        <span className="text-xs text-gray-400 shrink-0">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{notification.body}</p>
                      {notification.type === "expiring" && postId && !notification.body.includes("has been renewed") && (
                        <button
                          onClick={(e) => handleRenew(postId, e)}
                          className="mt-2 text-xs font-semibold text-white bg-maroon-600 hover:bg-maroon-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Renew Post
                        </button>
                      )}
                    </div>
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-maroon-500 shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              );
            })}

            {pagination && pagination.page < pagination.totalPages && (
              <button
                onClick={() => fetchNotifications(pagination.page + 1)}
                className="w-full py-3 text-sm font-medium text-maroon-600 hover:text-maroon-700 transition-colors"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
