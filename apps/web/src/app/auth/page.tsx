"use client";

import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function AuthPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (user) router.push("/");
  }, [user, router]);

  const googleLogin = useGoogleLogin({
    flow: "auth-code",
    hosted_domain: "uchicago.edu",
    onSuccess: async (response) => {
      setIsLoading(true);
      setError("");
      try {
        const result = await login(response.code);
        if (result.needsPhoneVerification) {
          router.push("/auth/verify");
        } else {
          router.push("/");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setError("Google sign-in was cancelled or failed");
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <img src="/logos/emart-logo-long.svg" alt="UChicago E-mart" className="h-12" />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">
            Welcome to UChicago E-mart
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Sign in with your UChicago Google account
          </p>

          {error && (
            <div className="text-sm text-maroon-700 bg-maroon-100 rounded-lg px-3 py-2.5 mb-4">
              {error}
            </div>
          )}

          <button
            onClick={() => googleLogin()}
            disabled={isLoading}
            className="w-full border border-gray-300 text-gray-700 text-sm font-semibold py-3 rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with UChicago Google
              </>
            )}
          </button>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 text-center">
              Only <strong>@uchicago.edu</strong> accounts can sign in. After your first login, you&#39;ll verify your phone number for account security.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
