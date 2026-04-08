"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  ReportWithDetails,
  ReportAction,
  ReportCategory,
} from "@uchicago-marketplace/shared";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { WarnUserModal } from "./WarnUserModal";

interface ReportCardProps {
  report: ReportWithDetails;
  onResolve: (reportId: string, action: ReportAction) => Promise<void>;
}

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  scam: "SCAM",
  spam: "SPAM",
  prohibited_item: "PROHIBITED",
  harassment: "HARASSMENT",
  misleading: "MISLEADING",
  other: "OTHER",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ReportCard({ report, onResolve }: ReportCardProps) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBan, setConfirmBan] = useState(false);
  const [showWarn, setShowWarn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = report.status === "open";

  const run = async (action: ReportAction) => {
    setBusy(true);
    setError(null);
    try {
      await onResolve(report.id, action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
      setConfirmBan(false);
      setShowWarn(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="inline-block px-2 py-0.5 text-xs font-bold bg-red-100 text-red-700 rounded">
          {CATEGORY_LABELS[report.category]}
        </span>
        <span className="text-xs text-gray-500">
          reported {timeAgo(report.createdAt)} by {report.reporter.name} (
          {report.reporter.email})
        </span>
      </div>

      {/* Post info */}
      <div className="mb-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Post
        </div>
        <div className="text-base font-semibold text-gray-900">
          {report.post.title}
        </div>
        <div className="text-xs text-gray-500">
          by {report.post.author.name} ({report.post.author.email}) · status:{" "}
          {report.post.status}
        </div>
      </div>

      {/* Detail */}
      {report.detail && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Reporter note
          </div>
          <div className="text-sm text-gray-700 whitespace-pre-line">
            {report.detail}
          </div>
        </div>
      )}

      {/* Resolution info for non-open reports */}
      {!isOpen && (
        <div className="mb-3 text-xs text-gray-500">
          {report.status === "dismissed" ? "Dismissed" : "Actioned"}
          {report.resolver && ` by ${report.resolver.name}`}
          {report.resolvedAt &&
            ` on ${new Date(report.resolvedAt).toLocaleString()}`}
          {report.actionTaken && ` — action: ${report.actionTaken}`}
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg px-3 py-2 text-sm bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {/* Actions (only for open reports) */}
      {isOpen && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          <Link
            href={`/posts/${report.post.id}`}
            target="_blank"
            className="px-3 py-1.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View Post
          </Link>
          <button
            onClick={() => run({ action: "dismiss" })}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Delete Post
          </button>
          <button
            onClick={() => setConfirmBan(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-red-800 rounded-lg hover:bg-red-900 disabled:opacity-50"
          >
            Ban User
          </button>
          <button
            onClick={() => setShowWarn(true)}
            disabled={busy}
            className="px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            Warn User
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete post?"
        message={`This will mark "${report.post.title}" as deleted and hide it from the marketplace. This cannot be undone.`}
        variant="danger"
        confirmLabel="Delete post"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run({ action: "delete_post" })}
      />

      <ConfirmDialog
        open={confirmBan}
        title={`Ban ${report.post.author.name}?`}
        message={`This will ban ${report.post.author.name} (${report.post.author.email}) AND delete ALL of their active posts. The user will be locked out immediately. This cannot be undone from the UI.`}
        variant="danger"
        confirmLabel="Ban user"
        busy={busy}
        onCancel={() => setConfirmBan(false)}
        onConfirm={() => run({ action: "ban_user" })}
      />

      <WarnUserModal
        open={showWarn}
        initialCategory={report.category}
        onCancel={() => setShowWarn(false)}
        onSubmit={async (category, detail) => {
          await run({ action: "warn_user", category, detail });
        }}
      />
    </div>
  );
}
