"use client";

import { useState } from "react";
import { Modal } from "../ui/Modal";
import type { ReportCategory } from "@uchicago-marketplace/shared";

interface WarnUserModalProps {
  open: boolean;
  initialCategory: ReportCategory;
  onCancel: () => void;
  onSubmit: (category: ReportCategory, detail?: string) => Promise<void>;
}

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export function WarnUserModal({
  open,
  initialCategory,
  onCancel,
  onSubmit,
}: WarnUserModalProps) {
  const [category, setCategory] = useState<ReportCategory>(initialCategory);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(category, detail.trim() || undefined);
      setDetail("");
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send warning");
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title="Warn user"
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send warning"}
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
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
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
            Custom message (optional)
          </span>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
            disabled={busy}
            rows={4}
            placeholder="Leave blank to send the default warning for this category."
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <span className="block text-xs text-gray-400 mt-1">
            {detail.length}/1000
          </span>
        </label>

        {error && (
          <div className="rounded-lg px-3 py-2 text-sm bg-red-50 text-red-800 border border-red-200">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
