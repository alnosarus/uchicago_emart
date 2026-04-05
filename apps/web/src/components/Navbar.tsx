"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/NotificationBell";
import { MessageBell } from "@/components/MessageBell";

export function Navbar() {
  const { user, isLoading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between sticky top-0 z-50 shadow-sm">
      <Link href="/" className="flex items-center gap-3 shrink-0 ml-2 sm:ml-4">
        <img src="/logos/logover3.svg" alt="UChicago E-mart" className="h-11 sm:h-12" />
        <div className="w-px h-7 bg-gray-300" />
        <img src="/logos/Gothic_UChicago_Wordmark_1Color_Maroon_RGB.svg" alt="UChicago" className="h-8 sm:h-9" />
      </Link>
      <div className="flex items-center gap-2 sm:gap-3">
        {isLoading ? (
          <div className="w-16 sm:w-20 h-8 bg-gray-100 rounded-full animate-pulse" />
        ) : user ? (
          <>
            <Link href="/create" className="flex items-center justify-center w-[34px] h-[34px] rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-maroon-700 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            </Link>
            <NotificationBell />
            <MessageBell />
            <div className="w-px h-6 bg-gray-200 mx-1" />
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
                  <div className="border-t border-gray-100 my-1" />
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" /></svg>
                    Log Out
                  </button>
                </div>
              )}
            </div>
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
  );
}
