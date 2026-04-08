"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/lib/auth-context";
import { SocketProvider } from "@/lib/socket-context";
import { GoogleMapsProvider } from "@/components/housing/GoogleMapsLoader";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ""}>
      <AuthProvider>
        <SocketProvider>
          <GoogleMapsProvider>{children}</GoogleMapsProvider>
        </SocketProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
