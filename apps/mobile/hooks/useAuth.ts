import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { api, setTokenGetter } from "@/lib/api";
import { GOOGLE_AUTH_CONFIG } from "@/lib/auth-config";

/* ─── Constants ─── */

const TOKEN_STORAGE_KEY = "auth_access_token";
const USER_STORAGE_KEY = "auth_user";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/* ─── Types ─── */

interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ─── Secure storage helpers ─── */

async function saveToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  } catch {
    // Secure store may not be available in all environments
  }
}

async function loadToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function saveUser(user: AuthUser): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Secure store may not be available in all environments
  }
}

async function loadUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
    return null;
  } catch {
    return null;
  }
}

async function clearStorage(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
  } catch {
    // Ignore cleanup errors
  }
}

/* ─── Provider ─── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Keep a ref so getToken always returns the latest value without
  // needing to re-render consumers that only read the function reference.
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = accessToken;

  const getToken = useCallback(() => tokenRef.current, []);

  // Wire up the API client token getter
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Build the redirect URI for OAuth
  const redirectUri = AuthSession.makeRedirectUri();

  // Build the auth request for Google (authorization code flow)
  const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
    tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_AUTH_CONFIG.clientId,
      scopes: GOOGLE_AUTH_CONFIG.scopes,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery,
  );

  // On mount: try to restore session from storage, then try refresh
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        // First try loading from secure store
        const [storedToken, storedUser] = await Promise.all([
          loadToken(),
          loadUser(),
        ]);

        if (storedToken && storedUser && !cancelled) {
          setAccessToken(storedToken);
          setUser(storedUser);
          tokenRef.current = storedToken;
        }

        // Try to refresh the session with the API
        // This uses httpOnly cookies which may not work in React Native,
        // so failure is expected and not an error condition.
        try {
          const refreshResult = await api.auth.refresh();
          if (refreshResult?.accessToken && !cancelled) {
            setAccessToken(refreshResult.accessToken);
            tokenRef.current = refreshResult.accessToken;
            await saveToken(refreshResult.accessToken);
          }
        } catch {
          // Refresh failed — expected in React Native (no httpOnly cookie support).
          // If we have no stored token either, user stays logged out.
          if (!storedToken && !cancelled) {
            setAccessToken(null);
            setUser(null);
          }
        }
      } catch {
        // Storage read failed, stay logged out
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handle the OAuth response when it arrives
  useEffect(() => {
    if (response?.type === "success" && response.params?.code) {
      handleAuthCode(response.params.code);
    }
  }, [response]);

  async function handleAuthCode(code: string) {
    try {
      setIsLoading(true);
      const result = await api.auth.loginWithGoogle(code);

      const authUser: AuthUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        avatarUrl: result.user.avatarUrl,
        isVerified: result.user.isVerified,
      };

      setAccessToken(result.accessToken);
      setUser(authUser);
      tokenRef.current = result.accessToken;

      // Persist to secure storage
      await Promise.all([
        saveToken(result.accessToken),
        saveUser(authUser),
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Sign in failed";
      // Re-throw so the caller can catch if needed, but also log it
      console.error("Google auth error:", message);
      throw new Error(
        message.includes("uchicago.edu")
          ? "Only @uchicago.edu email addresses are allowed."
          : `Sign in failed: ${message}`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async () => {
    if (!request) {
      throw new Error(
        "Google Sign-In is not configured. Check your EXPO_PUBLIC_GOOGLE_CLIENT_ID.",
      );
    }
    await promptAsync();
    // The response is handled by the useEffect above
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Logout API call may fail if session is already gone; that's fine
    }

    setAccessToken(null);
    setUser(null);
    tokenRef.current = null;
    await clearStorage();
  }, []);

  const value: AuthContextValue = {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!accessToken && !!user,
    login,
    logout,
    getToken,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
