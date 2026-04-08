"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { useAuth } from "@/lib/auth-context";
import type { ReportCategory } from "@uchicago-marketplace/shared";

interface ReportPostModalProps {
  open: boolean;
  postId: string;
  onClose: () => void;
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export function ReportPostModal({ open, postId, onClose }: ReportPostModalProps) {
  const { fetchAuth } = useAuth();
  const [category, setCategory] = useState<ReportCategory>("scam");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  const reset = () => {
    setCategory("scam");
    setDetail("");
    setBanner(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    setBusy(true);
    setBanner(null);
    const res = await fetchAuth("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        postId,
        category,
        detail: detail.trim() || undefined,
      }),
    });
    setBusy(false);

    if (!res) {
      setBanner({ kind: "error", text: "You must be logged in to report." });
      return;
    }
    if (res.status === 201) {
      setBanner({
        kind: "success",
        text: "Report submitted. Thanks — an admin will review it.",
      });
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
      return;
    }
    if (res.status === 409) {
      setBanner({ kind: "error", text: "You've already reported this post." });
      return;
    }
    if (res.status === 403) {
      setBanner({
        kind: "error",
        text: "You must verify your phone number before reporting.",
      });
      return;
    }
    const body = await res.json().catch(() => ({
      message: "Failed to submit report",
    }));
    setBanner({ kind: "error", text: body.message || "Failed to submit report" });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Report this post"
      footer={
        <>
          <button
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Submitting..." : "Submit report"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Category
          </span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
            disabled={busy}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Details (optional)
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
            disabled={busy}
            rows={4}
            placeholder="What's wrong with this post?"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <span className="block text-xs text-gray-400 mt-1">
            {detail.length}/1000
          </span>
        </label>

        {banner && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              banner.kind === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {banner.text}
          </div>
        )}
      </div>
    </Modal>
  );
}
