"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

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
        }
      } catch {
        // No valid session
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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

    return { needsPhoneVerification: data.needsPhoneVerification };
  };

  const logout = async () => {
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
