import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import * as Google from "expo-auth-session/providers/google";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { api, setTokenGetter } from "@/lib/api";
import { GOOGLE_AUTH_CONFIG } from "@/lib/auth-config";

// Complete the auth session for web-based redirect
WebBrowser.maybeCompleteAuthSession();

/* ─── Constants ─── */

const TOKEN_STORAGE_KEY = "auth_access_token";
const USER_STORAGE_KEY = "auth_user";

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

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = accessToken;

  const getToken = useCallback(() => tokenRef.current, []);

  // Wire up the API client token getter
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Use expo-auth-session's Google provider — handles token exchange client-side
  // This gives us an id_token directly, avoiding the server-side code exchange
  // redirect URI mismatch that causes invalid_grant errors
  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_AUTH_CONFIG.iosClientId,
    scopes: GOOGLE_AUTH_CONFIG.scopes,
  });

  // On mount: try to restore session from storage
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          loadToken(),
          loadUser(),
        ]);

        if (storedToken && storedUser && !cancelled) {
          setAccessToken(storedToken);
          setUser(storedUser);
          tokenRef.current = storedToken;
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
    return () => { cancelled = true; };
  }, []);

  // Handle the OAuth response when it arrives
  useEffect(() => {
    if (response?.type === "success") {
      console.log("Google auth response keys:", Object.keys(response.authentication || {}));
      console.log("Has idToken:", !!response.authentication?.idToken);
      console.log("Has accessToken:", !!response.authentication?.accessToken);
      if (response.authentication?.idToken) {
        // Log the audience (2nd segment of JWT)
        try {
          const claims = JSON.parse(atob(response.authentication.idToken.split(".")[1]));
          console.log("idToken audience:", claims.aud);
          console.log("idToken email:", claims.email);
        } catch { /* ignore */ }
        handleIdToken(response.authentication.idToken);
      } else if (response.authentication?.accessToken) {
        handleGoogleAccessToken(response.authentication.accessToken);
      }
    }
  }, [response]);

  async function handleIdToken(idToken: string) {
    try {
      setIsLoading(true);
      // Send the id_token to our API for verification and session creation
      const result = await api.auth.loginWithGoogle(idToken);

      const authUser: AuthUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        avatarUrl: result.user.avatarUrl ?? null,
        isVerified: result.user.isVerified,
      };

      setAccessToken(result.accessToken);
      setUser(authUser);
      tokenRef.current = result.accessToken;

      await Promise.all([saveToken(result.accessToken), saveUser(authUser)]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sign in failed";
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

  async function handleGoogleAccessToken(googleAccessToken: string) {
    try {
      setIsLoading(true);
      // Send the Google access token to our API — it will verify with Google
      const result = await api.auth.loginWithGoogle(googleAccessToken);

      const authUser: AuthUser = {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        avatarUrl: result.user.avatarUrl ?? null,
        isVerified: result.user.isVerified,
      };

      setAccessToken(result.accessToken);
      setUser(authUser);
      tokenRef.current = result.accessToken;

      await Promise.all([saveToken(result.accessToken), saveUser(authUser)]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sign in failed";
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
        "Google Sign-In is not configured. Check EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.",
      );
    }
    await promptAsync();
    // The response is handled by the useEffect above
  }, [request, promptAsync]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Logout API call may fail if session is already gone
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
