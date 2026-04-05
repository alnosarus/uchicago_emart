"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function MessageBell() {
  const { accessToken } = useAuth();
  const socket = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    async function fetchCount() {
      try {
        const res = await fetch(`${API_URL}/api/conversations/unread-count`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch {
        // ignore
      }
    }

    fetchCount();

    // Also poll every 30s as a fallback
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [accessToken]);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on("new_message", handleNewMessage);
    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [socket]);

  return (
    <Link
      href="/messages"
      className="relative text-lg sm:text-xl px-1.5 sm:px-2 py-1 rounded-full hover:bg-gray-100 transition-colors"
    >
      {"\uD83D\uDCAC"}
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-maroon-600 text-white text-[10px] font-bold rounded-full px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
