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
  fetchAuth: (path: string, options?: RequestInit) => Promise<Response | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  // Keep ref in sync so callbacks always see the latest token
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

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

  // Deduplicated token refresh — returns the new token or null.
  // Multiple callers hitting 401 at the same time will share one refresh request.
  const doRefresh = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;
    refreshPromiseRef.current = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          tokenRef.current = data.accessToken;
          if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = setTimeout(silentRefresh, 14 * 60 * 1000);
          return data.accessToken as string;
        } else {
          setUser(null);
          setAccessToken(null);
          tokenRef.current = null;
          return null;
        }
      } catch {
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();
    return refreshPromiseRef.current;
  }, []);

  // Silently refresh the access token using the httpOnly refresh cookie.
  const silentRefresh = useCallback(async () => {
    const token = await doRefresh();
    if (!token) {
      // Network error — retry in 30s
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      // Only retry if we still have a user (i.e. it was a network error, not a revoked refresh token)
      if (tokenRef.current !== null) {
        refreshTimerRef.current = setTimeout(silentRefresh, 30 * 1000);
      }
    }
  }, [doRefresh]);

  // Authenticated fetch: on 401, refresh the token once and retry.
  // Returns null if the user is logged out or refresh fails.
  const fetchAuth = useCallback(async (path: string, options: RequestInit = {}): Promise<Response | null> => {
    const token = tokenRef.current;
    if (!token) return null;
    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
      if (res.status === 401) {
        const newToken = await doRefresh();
        if (!newToken) return null;
        return fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });
      }
      return res;
    } catch {
      return null;
    }
  }, [doRefresh]);

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
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, refreshUser, fetchAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
