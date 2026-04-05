"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
  const { user, accessToken, isLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (page: number = 1) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/notifications?page=${page}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(page === 1 ? data.data : [...notifications, ...data.data]);
      setPagination(data.pagination);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [accessToken, notifications]);

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
        <div className="w-8 h-8 border-3 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-xl sm:text-2xl font-bold tracking-wide uppercase bg-gradient-to-br from-maroon-700 to-maroon-500 bg-clip-text text-transparent">
            UChicago
          </span>
          <span className="hidden sm:inline text-sm font-medium text-gray-400 uppercase tracking-wider">
            Marketplace
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-gray-600 hover:text-maroon-600 transition-colors"
        >
          Home
        </Link>
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
    </>
  );
}
