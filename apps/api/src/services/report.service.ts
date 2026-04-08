import { Prisma, type ReportCategory } from "@prisma/client";
import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";
import type {
  ResolveReportInput,
  ListReportsQuery,
} from "@uchicago-marketplace/shared";

// Default warning messages used when the admin doesn't supply custom
// text. Kept next to the resolver since it's small and only used here.
const WARN_TEMPLATES: Record<ReportCategory, string> = {
  spam: "Your post was flagged as spam. Please review our posting guidelines.",
  scam: "Your post was flagged as a potential scam. Do not request payment before meetup.",
  prohibited_item: "Your post contains a prohibited item and has been flagged.",
  harassment:
    "Your post was flagged for harassment. Please review our community guidelines.",
  misleading:
    "Your post was flagged as misleading. Please update it with accurate information.",
  other: "Your post was flagged by a moderator.",
};

export async function createReport(
  reporterId: string,
  postId: string,
  category: ReportCategory,
  detail?: string
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true },
  });
  if (!post || post.status === "deleted") {
    throw new HttpError(404, "Post not found");
  }
  if (post.authorId === reporterId) {
    throw new HttpError(400, "You cannot report your own post");
  }

  try {
    return await prisma.report.create({
      data: {
        postId,
        reporterId,
        category,
        detail: detail ?? null,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new HttpError(409, "You have already reported this post");
    }
    throw err;
  }
}

export async function listReports(query: ListReportsQuery) {
  const { status = "open", category, page, limit } = query;
  const where = {
    status,
    ...(category ? { category } : {}),
  };

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        post: {
          select: {
            id: true,
            title: true,
            status: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
        resolver: { select: { id: true, name: true } },
      },
    }),
    prisma.report.count({ where }),
  ]);

  return { reports, total, page, limit };
}

export async function resolveReport(
  reportId: string,
  adminId: string,
  action: ResolveReportInput
) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id: reportId },
      include: { post: { select: { id: true, authorId: true } } },
    });
    if (!report) {
      throw new HttpError(404, "Report not found");
    }
    if (report.status !== "open") {
      throw new HttpError(400, "Report already resolved");
    }

    let actionTaken: string | null = null;

    switch (action.action) {
      case "dismiss":
        break;

      case "delete_post":
        await tx.post.update({
          where: { id: report.postId },
          data: { status: "deleted" },
        });
        actionTaken = "deleted";
        break;

      case "ban_user": {
        const authorId = report.post.authorId;
        await tx.user.update({
          where: { id: authorId },
          data: { isBanned: true },
        });
        await tx.post.updateMany({
          where: { authorId, status: "active" },
          data: { status: "deleted" },
        });
        actionTaken = "banned";
        break;
      }

      case "warn_user":
        await tx.notification.create({
          data: {
            userId: report.post.authorId,
            type: "system",
            title: `Warning: ${action.category.replace("_", " ")}`,
            body: action.detail ?? WARN_TEMPLATES[action.category],
            link: `/posts/${report.postId}`,
          },
        });
        actionTaken = "warned";
        break;
    }

    return tx.report.update({
      where: { id: reportId },
      data: {
        status: action.action === "dismiss" ? "dismissed" : "actioned",
        resolvedBy: adminId,
        resolvedAt: new Date(),
        actionTaken,
      },
      include: {
        reporter: { select: { id: true, name: true, email: true } },
        post: {
          select: {
            id: true,
            title: true,
            status: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
        resolver: { select: { id: true, name: true } },
      },
    });
  });
}
