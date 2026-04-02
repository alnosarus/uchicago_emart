import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthState {
  accessToken: string | null;
  user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  getToken: () => string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ accessToken: null, user: null, isLoading: false });
  const getToken = useCallback(() => state.accessToken, [state.accessToken]);
  const setToken = useCallback((token: string) => { setState((prev) => ({ ...prev, accessToken: token })); }, []);
  const logout = useCallback(() => { setState({ accessToken: null, user: null, isLoading: false }); }, []);

  return React.createElement(AuthContext.Provider, { value: { ...state, getToken, setToken, logout } }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
