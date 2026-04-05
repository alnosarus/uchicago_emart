"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";

export function MessageBell() {
  const { accessToken, fetchAuth } = useAuth();
  const socket = useSocket();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!accessToken) return;

    let stopped = false;

    async function fetchCount() {
      if (stopped) return;
      const res = await fetchAuth("/api/conversations/unread-count");
      if (!res || stopped) return;
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [accessToken, fetchAuth]);

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
      className="relative flex items-center justify-center w-[34px] h-[34px] rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-maroon-700 transition-colors"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-maroon-600 text-white text-[10px] font-bold rounded-full px-1">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
