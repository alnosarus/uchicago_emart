export type ReportCategory =
  | "spam"
  | "scam"
  | "prohibited_item"
  | "harassment"
  | "misleading"
  | "other";

export type ReportStatus = "open" | "dismissed" | "actioned";

export type ReportAction =
  | { action: "dismiss" }
  | { action: "delete_post" }
  | { action: "ban_user" }
  | { action: "warn_user"; category: ReportCategory; detail?: string };

export interface Report {
  id: string;
  postId: string;
  reporterId: string;
  category: ReportCategory;
  detail: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  actionTaken: string | null;
  createdAt: string;
}

export interface ReportWithDetails extends Report {
  reporter: {
    id: string;
    name: string;
    email: string;
  };
  post: {
    id: string;
    title: string;
    status: string;
    author: {
      id: string;
      name: string;
      email: string;
    };
  };
  resolver: {
    id: string;
    name: string;
  } | null;
}

export interface ListReportsResponse {
  reports: ReportWithDetails[];
  total: number;
  page: number;
  limit: number;
}
