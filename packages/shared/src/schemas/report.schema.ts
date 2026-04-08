import { z } from "zod";

export const reportCategoryEnum = z.enum([
  "spam",
  "scam",
  "prohibited_item",
  "harassment",
  "misleading",
  "other",
]);

export const createReportSchema = z.object({
  postId: z.string().uuid(),
  category: reportCategoryEnum,
  detail: z.string().max(1000).optional(),
});

export const resolveReportSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dismiss") }),
  z.object({ action: z.literal("delete_post") }),
  z.object({ action: z.literal("ban_user") }),
  z.object({
    action: z.literal("warn_user"),
    category: reportCategoryEnum,
    detail: z.string().max(1000).optional(),
  }),
]);

export const listReportsQuerySchema = z.object({
  status: z.enum(["open", "dismissed", "actioned"]).optional(),
  category: reportCategoryEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
