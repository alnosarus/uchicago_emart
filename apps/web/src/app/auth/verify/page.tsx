"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { getFirebaseAuth, RecaptchaVerifier, signInWithPhoneNumber } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function VerifyPhonePage() {
  const { user, accessToken, refreshUser } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) {
      router.push("/auth");
    }
  }, [user, router]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Format phone to E.164
      let formatted = phone.replace(/\D/g, "");
      if (!formatted.startsWith("1") && formatted.length === 10) {
        formatted = "1" + formatted;
      }
      formatted = "+" + formatted;

      // Set up reCAPTCHA
      if (!recaptchaRef.current) return;
      const recaptchaVerifier = new RecaptchaVerifier(getFirebaseAuth(), recaptchaRef.current, {
        size: "invisible",
      });

      // Send SMS via Firebase
      const result = await signInWithPhoneNumber(getFirebaseAuth(), formatted, recaptchaVerifier);
      setConfirmation(result);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!confirmation) throw new Error("No confirmation result");

      // Confirm the SMS code with Firebase
      const credential = await confirmation.confirm(code);
      const firebaseIdToken = await credential.user.getIdToken();

      // Send Firebase token to our API to mark user as verified
      const res = await fetch(`${API_URL}/api/auth/verify-phone/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ firebaseIdToken }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Verification failed");
      }

      await refreshUser();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setIsLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logos/emart-logo.svg" alt="UChicago E-mart" className="h-12 mx-auto" />
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
          <h1 className="text-xl font-extrabold text-gray-900 text-center mb-1">
            Verify Your Phone
          </h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            {step === "phone"
              ? "We'll send a verification code to confirm your identity."
              : "Enter the 6-digit code we sent to your phone."}
          </p>

          {error && (
            <div className="text-sm text-maroon-700 bg-maroon-100 rounded-lg px-3 py-2.5 mb-4">
              {error}
            </div>
          )}

          {step === "phone" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(312) 555-0123"
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm bg-gray-50 focus:border-maroon-400 focus:bg-white focus:ring-2 focus:ring-maroon-600/10 outline-none transition-all"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">US numbers only. We&#39;ll send an SMS.</p>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold py-3 rounded-lg shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send Verification Code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-2xl text-center tracking-widest bg-gray-50 focus:border-maroon-400 focus:bg-white focus:ring-2 focus:ring-maroon-600/10 outline-none transition-all"
                  maxLength={6}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || code.length !== 6}
                className="w-full bg-gradient-to-br from-maroon-600 to-maroon-700 text-white text-sm font-semibold py-3 rounded-lg shadow-md hover:from-maroon-700 hover:to-maroon-800 transition-all disabled:opacity-50"
              >
                {isLoading ? "Verifying..." : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("phone"); setCode(""); setError(""); }}
                className="w-full text-sm text-gray-500 hover:text-maroon-600 transition-colors"
              >
                Use a different number
              </button>
            </form>
          )}
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-4 transition-colors"
        >
          Skip for now
        </button>

        {/* Invisible reCAPTCHA container */}
        <div ref={recaptchaRef} />
      </div>
    </div>
  );
}
