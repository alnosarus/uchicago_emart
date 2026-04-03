import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";

interface CreateReviewInput {
  postId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  text?: string | null;
}

export async function createReview(input: CreateReviewInput) {
  const { postId, reviewerId, revieweeId, rating, text } = input;

  const eligibility = await isEligibleToReview(reviewerId, postId);
  if (!eligibility.eligible) {
    if (eligibility.alreadyReviewed) {
      throw new HttpError(400, "You have already reviewed this transaction");
    }
    throw new HttpError(403, "You are not eligible to review this transaction");
  }

  if (eligibility.revieweeId !== revieweeId) {
    throw new HttpError(400, "Invalid reviewee for this transaction");
  }

  const review = await prisma.review.create({
    data: { postId, reviewerId, revieweeId, rating, text: text ?? null },
    include: {
      reviewer: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return review;
}

export async function getReviewsForUser(userId: string, page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;

  const [reviews, total, aggregate] = await Promise.all([
    prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        reviewer: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.review.count({ where: { revieweeId: userId } }),
    prisma.review.aggregate({
      where: { revieweeId: userId },
      _avg: { rating: true },
    }),
  ]);

  return { data: reviews, total, averageRating: aggregate._avg.rating };
}

export async function isEligibleToReview(
  userId: string,
  postId: string,
): Promise<{
  eligible: boolean;
  revieweeId?: string;
  revieweeName?: string;
  alreadyReviewed: boolean;
}> {
  const transaction = await prisma.transaction.findUnique({
    where: { postId },
    include: {
      seller: { select: { id: true, name: true } },
      buyer: { select: { id: true, name: true } },
    },
  });

  if (!transaction) {
    return { eligible: false, alreadyReviewed: false };
  }

  let revieweeId: string | undefined;
  let revieweeName: string | undefined;

  if (transaction.sellerId === userId) {
    revieweeId = transaction.buyerId;
    revieweeName = transaction.buyer.name;
  } else if (transaction.buyerId === userId) {
    revieweeId = transaction.sellerId;
    revieweeName = transaction.seller.name;
  } else {
    return { eligible: false, alreadyReviewed: false };
  }

  const existingReview = await prisma.review.findUnique({
    where: { postId_reviewerId: { postId, reviewerId: userId } },
  });

  if (existingReview) {
    return { eligible: false, revieweeId, revieweeName, alreadyReviewed: true };
  }

  return { eligible: true, revieweeId, revieweeName, alreadyReviewed: false };
}
