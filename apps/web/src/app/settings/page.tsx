"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import imageCompression from "browser-image-compression";
import { Navbar } from "@/components/Navbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function SettingsPage() {
  const { user, accessToken, isLoading, logout, refreshUser } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth guard + pre-fill form
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth");
      return;
    }
    if (user) {
      setName(user.name);
      setAvatarPreview(user.avatarUrl);
    }
  }, [user, isLoading, router]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : "?";

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    setError(null);
    setUploadingAvatar(true);

    try {
      // Client-side compression
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });

      // Show preview immediately
      const previewUrl = URL.createObjectURL(compressed);
      setAvatarPreview(previewUrl);

      // Upload to API
      const formData = new FormData();
      formData.append("avatar", compressed, compressed.name);

      const res = await fetch(`${API_URL}/api/users/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to upload avatar");
      }

      const { url } = await res.json();
      setAvatarPreview(url);

      // Revoke the blob URL
      URL.revokeObjectURL(previewUrl);

      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload avatar");
      // Revert preview
      setAvatarPreview(user?.avatarUrl ?? null);
    } finally {
      setUploadingAvatar(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setError(null);
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: trimmedName,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to update profile");
      }

      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-maroon-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 sm:px-8 py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-8">Edit Profile</h1>

        <form onSubmit={handleSave} className="space-y-8">
          {/* Avatar section */}
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative group"
            >
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-[200px] h-[200px] rounded-full object-cover border-4 border-gray-100 shadow-sm group-hover:border-maroon-200 transition-colors"
                />
              ) : (
                <div className="w-[200px] h-[200px] rounded-full bg-gradient-to-br from-maroon-500 to-maroon-700 flex items-center justify-center text-white text-5xl font-bold border-4 border-gray-100 shadow-sm group-hover:border-maroon-200 transition-colors">
                  {initials}
                </div>
              )}
              {/* Overlay */}
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
                </svg>
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <p className="text-sm text-gray-400">Click to change photo</p>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:border-transparent transition-shadow"
              placeholder="Your full name"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700">
                {user.phone || <span className="text-gray-400">Not verified</span>}
              </div>
              <Link
                href="/auth/verify"
                className="text-sm font-medium text-maroon-600 hover:text-maroon-700 whitespace-nowrap transition-colors"
              >
                {user.phone ? "Change" : "Verify"}
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Phone number is verified via SMS and kept private.</p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
              Profile updated!
            </div>
          )}

          {/* Save button */}
          <button
            type="submit"
            disabled={saving || uploadingAvatar}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm bg-gradient-to-br from-maroon-600 to-maroon-700 hover:from-maroon-700 hover:to-maroon-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </main>
    </div>
  );
}
