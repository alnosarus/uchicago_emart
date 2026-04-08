import type {
  Report,
  ReportWithDetails,
  ListReportsResponse,
  ReportCategory,
  ReportStatus,
  ReportAction,
} from "../types/report";
import { ApiClient } from "./client";

export function createReportsApi(client: ApiClient) {
  return {
    create(postId: string, category: ReportCategory, detail?: string) {
      return client.request<Report>("/api/reports", {
        method: "POST",
        body: { postId, category, detail },
      });
    },

    list(
      params: {
        status?: ReportStatus;
        category?: ReportCategory;
        page?: number;
        limit?: number;
      } = {}
    ) {
      return client.request<ListReportsResponse>("/api/admin/reports", {
        params: {
          status: params.status,
          category: params.category,
          page: params.page,
          limit: params.limit,
        },
      });
    },

    resolve(reportId: string, action: ReportAction) {
      return client.request<ReportWithDetails>(
        `/api/admin/reports/${reportId}`,
        {
          method: "PATCH",
          body: action,
        }
      );
    },
  };
}
