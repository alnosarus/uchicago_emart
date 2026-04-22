import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";
import { createNotification } from "./notification.service";

const TRANSACTION_EXPIRY_DAYS = 7;

function expiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + TRANSACTION_EXPIRY_DAYS);
  return d;
}

async function expireIfStale(postId: string) {
  const txn = await prisma.transaction.findUnique({ where: { postId } });
  if (!txn || txn.status !== "pending") return txn;
  if (!txn.expiresAt || txn.expiresAt > new Date()) return txn;

  const post = await prisma.post.findUnique({ where: { id: postId } });

  const updated = await prisma.$transaction(async (tx) => {
    const expired = await tx.transaction.update({
      where: { postId },
      data: { status: "expired" },
    });
    // Seller-initiated: post was set to pending, mark it sold on expiry
    if (post?.status === "pending") {
      await tx.post.update({ where: { id: postId }, data: { status: "sold" } });
    }
    return expired;
  });

  return updated;
}

// Seller clicks "Mark as Sold"
export async function createTransaction(userId: string, postId: string, buyerId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.status !== "active") throw new HttpError(400, "Post is not active");
  if (post.authorId !== userId) throw new HttpError(403, "Only the post author can initiate a transaction");
  if (buyerId === userId) throw new HttpError(400, "Cannot create a transaction with yourself");

  const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { id: true, name: true, email: true } });
  if (!buyer) throw new HttpError(404, "Buyer not found");

  const existing = await prisma.transaction.findUnique({ where: { postId } });
  if (existing) throw new HttpError(409, "A transaction already exists for this post");

  const transaction = await prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: {
        postId,
        sellerId: userId,
        buyerId,
        sellerConfirmed: true,
        buyerConfirmed: false,
        status: "pending",
        expiresAt: expiresAt(),
      },
      include: {
        post: { select: { id: true, title: true, type: true } },
        seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
        buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      },
    });

    await tx.post.update({ where: { id: postId }, data: { status: "pending" } });

    return txn;
  });

  createNotification(
    buyerId,
    "match",
    "Transaction Confirmation Needed",
    `${transaction.seller.name} marked "${transaction.post.title}" as sold. Confirm to complete the transaction and unlock reviews.`,
    `/posts/${postId}`
  ).catch(() => {});

  return transaction;
}

// Buyer clicks "Mark as Bought" — only allowed if conversation with messages exists
export async function buyerInitiateTransaction(buyerId: string, postId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.status !== "active") throw new HttpError(400, "Post is not active");
  if (post.authorId === buyerId) throw new HttpError(400, "Cannot initiate a transaction on your own post");

  const conversation = await prisma.conversation.findFirst({
    where: {
      postId,
      OR: [
        { participant1Id: buyerId, participant2Id: post.authorId },
        { participant1Id: post.authorId, participant2Id: buyerId },
      ],
    },
    include: { messages: { take: 1 } },
  });

  if (!conversation || conversation.messages.length === 0) {
    throw new HttpError(403, "You must have a message history with the seller to initiate a transaction");
  }

  const existing = await prisma.transaction.findUnique({ where: { postId } });
  if (existing) throw new HttpError(409, "A transaction already exists for this post");

  const transaction = await prisma.transaction.create({
    data: {
      postId,
      sellerId: post.authorId,
      buyerId,
      sellerConfirmed: false,
      buyerConfirmed: true,
      status: "pending",
      expiresAt: expiresAt(),
    },
    include: {
      post: { select: { id: true, title: true, type: true } },
      seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
    },
  });

  createNotification(
    post.authorId,
    "match",
    "Transaction Confirmation Needed",
    `${transaction.buyer.name} marked "${transaction.post.title}" as bought. Confirm to complete the transaction and unlock reviews.`,
    `/posts/${postId}`
  ).catch(() => {});

  return transaction;
}

// The other party confirms the transaction
export async function confirmTransaction(userId: string, postId: string) {
  const txn = await expireIfStale(postId);
  if (!txn) throw new HttpError(404, "Transaction not found");
  if (txn.status === "expired") throw new HttpError(410, "This transaction has expired");
  if (txn.status === "completed") throw new HttpError(400, "Transaction is already confirmed");

  const isSeller = txn.sellerId === userId;
  const isBuyer = txn.buyerId === userId;
  if (!isSeller && !isBuyer) throw new HttpError(403, "You are not part of this transaction");

  if (isSeller && txn.sellerConfirmed) throw new HttpError(400, "You have already confirmed this transaction");
  if (isBuyer && txn.buyerConfirmed) throw new HttpError(400, "You have already confirmed this transaction");

  const newSellerConfirmed = isSeller ? true : txn.sellerConfirmed;
  const newBuyerConfirmed = isBuyer ? true : txn.buyerConfirmed;
  const bothConfirmed = newSellerConfirmed && newBuyerConfirmed;

  const post = await prisma.post.findUnique({ where: { id: postId } });
  const newPostStatus = post?.type === "marketplace" ? "sold" : "completed";

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.transaction.update({
      where: { postId },
      data: {
        sellerConfirmed: newSellerConfirmed,
        buyerConfirmed: newBuyerConfirmed,
        status: bothConfirmed ? "completed" : "pending",
        confirmedAt: bothConfirmed ? new Date() : undefined,
      },
      include: {
        post: { select: { id: true, title: true, type: true } },
        seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
        buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      },
    });

    if (bothConfirmed) {
      await tx.post.update({ where: { id: postId }, data: { status: newPostStatus as any } });
    }

    return updated;
  });

  if (bothConfirmed) {
    const title = `"${updated.post.title}"`;
    createNotification(
      updated.sellerId,
      "match",
      "Transaction Complete — Leave a Review",
      `Your transaction for ${title} is confirmed. Reviews are now open — would you like to leave one?`,
      `/posts/${postId}`
    ).catch(() => {});

    createNotification(
      updated.buyerId,
      "match",
      "Transaction Complete — Leave a Review",
      `Your transaction for ${title} is confirmed. Reviews are now open — would you like to leave one?`,
      `/posts/${postId}`
    ).catch(() => {});
  }

  return updated;
}

export async function undoTransaction(userId: string, postId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { postId },
    include: { post: true },
  });

  if (!transaction) throw new HttpError(404, "Transaction not found");
  if (transaction.post.authorId !== userId) throw new HttpError(403, "Only the post author can undo a transaction");
  if (transaction.status === "completed") throw new HttpError(400, "Cannot undo a completed transaction");

  const hoursSinceCreation = (Date.now() - transaction.initiatedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCreation > 24) {
    throw new HttpError(400, "Cannot undo transaction after 24 hours");
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { postId } });
    await tx.post.update({ where: { id: postId }, data: { status: "active" } });
  });
}

export async function getTransactionByPostId(postId: string) {
  const txn = await expireIfStale(postId);
  if (!txn) return null;

  return prisma.transaction.findUnique({
    where: { postId },
    include: {
      post: { select: { id: true, title: true, type: true } },
      seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
    },
  });
}

export async function getUserTransactions(
  userId: string,
  page: number = 1,
  limit: number = 20,
  withUserId?: string,
) {
  const skip = (page - 1) * limit;

  const where = withUserId
    ? {
        OR: [
          { sellerId: userId, buyerId: withUserId },
          { sellerId: withUserId, buyerId: userId },
        ],
      }
    : {
        OR: [{ sellerId: userId }, { buyerId: userId }],
      };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { initiatedAt: "desc" },
      skip,
      take: limit,
      include: {
        post: {
          select: {
            id: true,
            title: true,
            type: true,
            side: true,
            images: { orderBy: { order: "asc" as const }, take: 1 },
          },
        },
        seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
        buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  const postIds = transactions.map((t) => t.postId);
  const existingReviews = postIds.length > 0
    ? await prisma.review.findMany({
        where: { postId: { in: postIds }, reviewerId: userId },
        select: { postId: true, rating: true },
      })
    : [];
  const reviewedMap = new Map(existingReviews.map((r) => [r.postId, r.rating]));

  return {
    data: transactions.map((t) => ({
      ...t,
      role: t.sellerId === userId ? "seller" : "buyer",
      counterparty: t.sellerId === userId ? t.buyer : t.seller,
      hasReviewed: reviewedMap.has(t.postId),
      myRating: reviewedMap.get(t.postId) ?? null,
      revieweeId: t.sellerId === userId ? t.buyerId : t.sellerId,
    })),
    total,
  };
}

export async function getUserTransactionCount(userId: string): Promise<number> {
  const [sold, bought] = await Promise.all([
    prisma.transaction.count({ where: { sellerId: userId } }),
    prisma.transaction.count({ where: { buyerId: userId } }),
  ]);
  return sold + bought;
}
