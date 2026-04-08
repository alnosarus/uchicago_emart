"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type {
  ListReportsResponse,
  ReportStatus,
  ReportCategory,
  ReportWithDetails,
  ReportAction,
} from "@uchicago-marketplace/shared";
import { ReportCard } from "@/components/admin/ReportCard";

const STATUS_TABS: { value: ReportStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "dismissed", label: "Dismissed" },
  { value: "actioned", label: "Actioned" },
];

const CATEGORIES: { value: "" | ReportCategory; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "scam", label: "Scam" },
  { value: "spam", label: "Spam" },
  { value: "prohibited_item", label: "Prohibited item" },
  { value: "harassment", label: "Harassment" },
  { value: "misleading", label: "Misleading" },
  { value: "other", label: "Other" },
];

export default function AdminReportsPage() {
  const { fetchAuth } = useAuth();
  const [status, setStatus] = useState<ReportStatus>("open");
  const [category, setCategory] = useState<"" | ReportCategory>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListReportsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      status,
      page: String(page),
      limit: "20",
    });
    if (category) qs.set("category", category);
    const res = await fetchAuth(`/api/admin/reports?${qs.toString()}`);
    if (!res) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res
        .json()
        .catch(() => ({ message: "Failed to load reports" }));
      setError(body.message || "Failed to load reports");
      setLoading(false);
      return;
    }
    const json = (await res.json()) as ListReportsResponse;
    setData(json);
    setLoading(false);
  }, [fetchAuth, status, category, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleResolved = (updated: ReportWithDetails) => {
    if (!data) return;
    if (updated.status !== status) {
      // No longer belongs in the current tab — remove it.
      setData({
        ...data,
        reports: data.reports.filter((r) => r.id !== updated.id),
        total: data.total - 1,
      });
    } else {
      setData({
        ...data,
        reports: data.reports.map((r) => (r.id === updated.id ? updated : r)),
      });
    }
  };

  const resolveReport = async (reportId: string, action: ReportAction) => {
    const res = await fetchAuth(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify(action),
    });
    if (!res || !res.ok) {
      const body = res ? await res.json().catch(() => ({})) : {};
      throw new Error(body.message || "Failed to resolve report");
    }
    const updated = (await res.json()) as ReportWithDetails;
    handleResolved(updated);
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.limit))
    : 1;

  return (
    <div>
      {/* Tab bar */}
      <nav className="flex gap-1 border-b border-gray-200 mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              status === tab.value
                ? "border-red-600 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {tab.label}
            {status === tab.value && data && ` (${data.total})`}
          </button>
        ))}
      </nav>

      {/* Category filter */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide mr-2">
          Category:
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as "" | ReportCategory);
            setPage(1);
          }}
          className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading && <div className="text-gray-500">Loading reports...</div>}
      {error && <div className="text-red-600">{error}</div>}
      {!loading && !error && data && data.reports.length === 0 && (
        <div className="text-gray-400 py-12 text-center">
          No reports in this tab.
        </div>
      )}
      {!loading && !error && data && data.reports.length > 0 && (
        <div className="space-y-3">
          {data.reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolve={resolveReport}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total > data.limit && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
