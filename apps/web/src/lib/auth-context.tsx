"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (code: string) => Promise<{ needsPhoneVerification: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchWithAuth = useCallback(async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
    return res;
  }, [accessToken]);

  // Silently refresh the access token using the httpOnly refresh cookie.
  // Schedules itself to run again 1 minute before the next token expires (14m).
  const silentRefresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
        // Schedule the next refresh for 14 minutes from now (token lives 15m)
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(silentRefresh, 14 * 60 * 1000);
      } else {
        // Refresh token expired — log the user out
        setUser(null);
        setAccessToken(null);
      }
    } catch {
      // Network error — retry in 30s
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(silentRefresh, 30 * 1000);
    }
  }, []);

  // Try to refresh token on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          // Fetch user profile
          const profileRes = await fetch(`${API_URL}/api/users/me/profile`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          });
          if (profileRes.ok) {
            setUser(await profileRes.json());
          }
          // Schedule proactive refresh before this token expires
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(silentRefresh, 14 * 60 * 1000);
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [silentRefresh]);

  const login = async (code: string) => {
    const res = await fetch(`${API_URL}/api/auth/google`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Login failed");
    }

    const data = await res.json();
    setAccessToken(data.accessToken);
    setUser(data.user);

    // Schedule proactive refresh before this token expires
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(silentRefresh, 14 * 60 * 1000);

    return { needsPhoneVerification: data.needsPhoneVerification };
  };

  const logout = async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    setAccessToken(null);
  };

  const refreshUser = async () => {
    if (!accessToken) return;
    const res = await fetchWithAuth("/api/users/me/profile");
    if (res.ok) {
      setUser(await res.json());
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
