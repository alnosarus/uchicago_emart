import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";

export async function createTransaction(userId: string, postId: string, buyerId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.status !== "active") throw new HttpError(400, "Post is not active");
  if (post.authorId !== userId) throw new HttpError(403, "Only the post author can complete a transaction");
  if (buyerId === userId) throw new HttpError(400, "Cannot create a transaction with yourself");

  const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
  if (!buyer) throw new HttpError(404, "Buyer not found");

  const newStatus = post.type === "marketplace" ? "sold" : "completed";

  const transaction = await prisma.$transaction(async (tx) => {
    const txn = await tx.transaction.create({
      data: { postId, sellerId: userId, buyerId },
      include: {
        post: { select: { id: true, title: true, type: true } },
        seller: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
        buyer: { select: { id: true, name: true, cnetId: true, avatarUrl: true } },
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: { status: newStatus as any },
    });

    return txn;
  });

  return transaction;
}

export async function undoTransaction(userId: string, postId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { postId },
    include: { post: true },
  });

  if (!transaction) throw new HttpError(404, "Transaction not found");
  if (transaction.post.authorId !== userId) throw new HttpError(403, "Only the post author can undo a transaction");

  const hoursSinceCompletion = (Date.now() - transaction.completedAt.getTime()) / (1000 * 60 * 60);
  if (hoursSinceCompletion > 24) {
    throw new HttpError(400, "Cannot undo transaction after 24 hours");
  }

  await prisma.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { postId } });
    await tx.post.update({ where: { id: postId }, data: { status: "active" } });
  });
}

export async function getTransactionByPostId(postId: string) {
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
) {
  const skip = (page - 1) * limit;

  const where = {
    OR: [{ sellerId: userId }, { buyerId: userId }],
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { completedAt: "desc" },
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

  return {
    data: transactions.map((t) => ({
      ...t,
      role: t.sellerId === userId ? "seller" : "buyer",
      counterparty: t.sellerId === userId ? t.buyer : t.seller,
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
