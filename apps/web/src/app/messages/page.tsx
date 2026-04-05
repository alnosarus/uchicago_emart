"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { NotificationBell } from "@/components/NotificationBell";
import { MessageBell } from "@/components/MessageBell";
import type { ConversationWithDetails, Message } from "@uchicago-marketplace/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// ── Helpers ──────────────────────────────────────

function timeAgo(dateString: string | Date): string {
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

function formatTimestamp(dateString: string | Date): string {
  const d = new Date(dateString);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ── Inner component (needs Suspense boundary for useSearchParams) ──

function MessagesPageInner() {
  const { user, accessToken, isLoading, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const socket = useSocket();

  // State
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Derived
  const activeConv = conversations.find((c) => c.id === activeConvId) ?? null;

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth");
    }
  }, [isLoading, user, router]);

  // ── Fetch conversations ──
  const fetchConversations = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API_URL}/api/conversations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.data ?? data);
    } catch {
      // ignore
    } finally {
      setLoadingConvs(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) fetchConversations();
  }, [accessToken, fetchConversations]);

  // ── Pre-select conversation from query param ──
  useEffect(() => {
    const convParam = searchParams.get("conversation");
    if (convParam && conversations.length > 0) {
      const exists = conversations.find((c) => c.id === convParam);
      if (exists) {
        setActiveConvId(convParam);
        setShowChat(true);
      }
    }
  }, [searchParams, conversations]);

  // ── Fetch messages when active conversation changes ──
  const fetchMessages = useCallback(
    async (convId: string, before?: string) => {
      if (!accessToken) return;
      setLoadingMsgs(true);
      try {
        const url = new URL(`${API_URL}/api/conversations/${convId}/messages`);
        if (before) url.searchParams.set("before", before);
        url.searchParams.set("limit", "30");

        const res = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const fetched: Message[] = data.data ?? data.messages ?? data;
        const more: boolean = data.hasMore ?? false;

        if (before) {
          setMessages((prev) => [...fetched, ...prev]);
        } else {
          setMessages(fetched);
        }
        setHasMore(more);
      } catch {
        // ignore
      } finally {
        setLoadingMsgs(false);
      }
    },
    [accessToken],
  );

  const markRead = useCallback(
    async (convId: string) => {
      if (!accessToken) return;
      try {
        await fetch(`${API_URL}/api/conversations/${convId}/read`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // ignore
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (activeConvId) {
      fetchMessages(activeConvId);
      markRead(activeConvId);
      // Clear unread locally
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, unreadCount: 0 } : c)),
      );
    } else {
      setMessages([]);
      setHasMore(false);
    }
  }, [activeConvId, fetchMessages, markRead]);

  // ── Auto-scroll to bottom when messages change ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Socket.IO events ──
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (payload: {
      message: Message;
      conversationId: string;
      conversation?: ConversationWithDetails;
    }) => {
      // If viewing this conversation, append message and mark read
      if (payload.conversationId === activeConvId) {
        setMessages((prev) => [...prev, payload.message]);
        markRead(payload.conversationId);
      }

      // Update conversation list
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === payload.conversationId);
        if (existing) {
          const updated = prev.map((c) => {
            if (c.id !== payload.conversationId) return c;
            return {
              ...c,
              lastMessage: {
                body: payload.message.body,
                senderId: payload.message.senderId,
                createdAt: payload.message.createdAt,
              },
              updatedAt: payload.message.createdAt,
              unreadCount:
                payload.conversationId === activeConvId
                  ? 0
                  : c.unreadCount + 1,
            };
          });
          // Bump to top
          const conv = updated.find((c) => c.id === payload.conversationId)!;
          return [conv, ...updated.filter((c) => c.id !== payload.conversationId)];
        } else if (payload.conversation) {
          return [payload.conversation, ...prev];
        }
        return prev;
      });
    };

    const handleMessagesRead = (payload: {
      conversationId: string;
      readAt: string;
      readBy: string;
    }) => {
      if (payload.conversationId === activeConvId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === user?.id && !m.readAt
              ? { ...m, readAt: new Date(payload.readAt) as unknown as Date }
              : m,
          ),
        );
      }
    };

    const handleConversationCreated = (payload: {
      conversation: ConversationWithDetails;
    }) => {
      setConversations((prev) => {
        if (prev.find((c) => c.id === payload.conversation.id)) return prev;
        return [payload.conversation, ...prev];
      });
    };

    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);
    socket.on("conversation_created", handleConversationCreated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
      socket.off("conversation_created", handleConversationCreated);
    };
  }, [socket, activeConvId, user?.id, markRead]);

  // ── Send message ──
  const handleSend = async () => {
    if (!activeConvId || !accessToken || !inputText.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(
        `${API_URL}/api/conversations/${activeConvId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: inputText.trim() }),
        },
      );
      if (!res.ok) return;
      const sent: Message = await res.json();
      setMessages((prev) => [...prev, sent]);
      setInputText("");

      // Update conversation list
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== activeConvId) return c;
          return {
            ...c,
            lastMessage: {
              body: sent.body,
              senderId: sent.senderId,
              createdAt: sent.createdAt,
            },
            updatedAt: sent.createdAt,
          };
        });
        const conv = updated.find((c) => c.id === activeConvId)!;
        return [conv, ...updated.filter((c) => c.id !== activeConvId)];
      });
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  // ── Key handler for input ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Select conversation ──
  const selectConversation = (convId: string) => {
    setActiveConvId(convId);
    setShowChat(true);
    // Clear unread locally
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c)),
    );
  };

  // ── Load older ──
  const loadOlder = () => {
    if (!activeConvId || messages.length === 0) return;
    const oldest = messages[0];
    fetchMessages(activeConvId, typeof oldest.createdAt === "string" ? oldest.createdAt : new Date(oldest.createdAt).toISOString());
  };

  // ── Loading state ──
  if (isLoading || loadingConvs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Render ──
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
                <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-xs font-bold shrink-0 relative z-50">
                  {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
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
                    <Link href="/messages" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-maroon-700 bg-maroon-50 font-medium transition-colors">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
                      Messages
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

      {/* Main content area — fills remaining viewport height */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>

        {/* ── Conversation List ── */}
        <div
          className={`${
            showChat ? "hidden md:flex" : "flex"
          } flex-col w-full md:w-[35%] md:min-w-[300px] md:max-w-[400px] border-r border-gray-200 bg-white overflow-hidden`}
        >
          {/* List header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h1 className="text-lg font-bold text-gray-900">Messages</h1>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                <p className="text-sm text-gray-500 font-medium">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  <Link href="/browse" className="text-maroon-600 hover:underline">
                    Browse posts
                  </Link>{" "}
                  to start chatting
                </p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    activeConvId === conv.id
                      ? "bg-maroon-50 border-l-2 border-l-maroon-600"
                      : "border-l-2 border-l-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-maroon-100 flex items-center justify-center text-maroon-700 text-sm font-bold shrink-0">
                    {initials(conv.otherParticipant.name)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${conv.unreadCount > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                        {conv.otherParticipant.name}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {timeAgo(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{conv.post.title}</p>
                    {conv.lastMessage && (
                      <p className={`text-sm truncate mt-0.5 ${conv.unreadCount > 0 ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                        {conv.lastMessage.body}
                      </p>
                    )}
                  </div>

                  {/* Unread badge */}
                  {conv.unreadCount > 0 && (
                    <span className="min-w-[20px] h-5 flex items-center justify-center bg-maroon-600 text-white text-[11px] font-bold rounded-full px-1.5 shrink-0 mt-1">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div
          className={`${
            showChat ? "flex" : "hidden md:flex"
          } flex-col flex-1 bg-white overflow-hidden`}
        >
          {activeConv ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white">
                {/* Back button (mobile only) */}
                <button
                  onClick={() => setShowChat(false)}
                  className="md:hidden p-1 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-maroon-100 flex items-center justify-center text-maroon-700 text-sm font-bold shrink-0">
                  {initials(activeConv.otherParticipant.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {activeConv.otherParticipant.name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-gray-500 truncate">{activeConv.post.title}</p>
                    {activeConv.post.price != null && (
                      <span className="text-xs font-medium text-maroon-600">
                        ${activeConv.post.price}
                      </span>
                    )}
                  </div>
                </div>

                {/* View Post link */}
                <Link
                  href={`/posts/${activeConv.post.id}`}
                  className="text-xs font-medium text-maroon-600 hover:text-maroon-700 transition-colors shrink-0"
                >
                  View Post &rarr;
                </Link>
              </div>

              {/* Messages area */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {/* Load older button */}
                {hasMore && (
                  <div className="text-center">
                    <button
                      onClick={loadOlder}
                      disabled={loadingMsgs}
                      className="text-xs font-medium text-maroon-600 hover:text-maroon-700 transition-colors disabled:opacity-50"
                    >
                      {loadingMsgs ? "Loading..." : "Load older messages"}
                    </button>
                  </div>
                )}

                {loadingMsgs && messages.length === 0 && (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* Message bubbles */}
                {messages.map((msg) => {
                  const isMine = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[75%] ${isMine ? "order-1" : ""}`}>
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                            isMine
                              ? "bg-maroon-600 text-white rounded-br-md"
                              : "bg-gray-100 text-gray-900 rounded-bl-md"
                          }`}
                        >
                          {msg.body}
                        </div>
                        <div
                          className={`flex items-center gap-1 mt-0.5 px-1 ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span className="text-[10px] text-gray-400">
                            {formatTimestamp(msg.createdAt)}
                          </span>
                          {isMine && (
                            <span
                              className={`text-xs ${
                                msg.readAt
                                  ? "text-maroon-600"
                                  : "text-gray-300"
                              }`}
                            >
                              {"✓✓"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-gray-200 px-4 py-3 bg-white">
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent disabled:opacity-50 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={sending || !inputText.trim()}
                    className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-maroon-600 text-white hover:bg-maroon-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty state — no conversation selected (desktop) */
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={0.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
              </svg>
              <p className="text-gray-400 font-medium">Select a conversation to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Exported page with Suspense boundary ──

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MessagesPageInner />
    </Suspense>
  );
}
