import type { User } from "../types/user";
import { ApiClient } from "./client";

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  needsPhoneVerification: boolean;
}

export function createAuthApi(client: ApiClient) {
  return {
    loginWithGoogle(code: string) {
      return client.request<AuthResponse>("/api/auth/google", {
        method: "POST",
        body: { code },
      });
    },

    requestPhoneVerification(phone: string) {
      return client.request<{ success: boolean }>("/api/auth/verify-phone", {
        method: "POST",
        body: { phone },
      });
    },

    confirmPhoneVerification(phone: string, code: string) {
      return client.request<{ user: User }>("/api/auth/verify-phone/confirm", {
        method: "POST",
        body: { phone, code },
      });
    },

    refresh() {
      return client.request<{ accessToken: string }>("/api/auth/refresh", {
        method: "POST",
      });
    },

    logout() {
      return client.request<void>("/api/auth/logout", { method: "POST" });
    },
  };
}
