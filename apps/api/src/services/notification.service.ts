import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";
import { APP_CONFIG } from "@uchicago-marketplace/shared";

export async function createNotification(
  userId: string,
  type: "message" | "review" | "save" | "match" | "expiring" | "system",
  title: string,
  body: string,
  link?: string | null
) {
  return prisma.notification.create({
    data: { userId, type, title, body, link: link ?? null },
  });
}

export async function getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  // Check for expiring posts before returning notifications
  await checkExpiringPosts(userId);

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { userId } }),
  ]);

  return {
    data: notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) throw new HttpError(404, "Notification not found");
  if (notification.userId !== userId) throw new HttpError(403, "Not authorized");

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

async function checkExpiringPosts(userId: string) {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const expiringPosts = await prisma.post.findMany({
    where: {
      authorId: userId,
      status: "active",
      expirationNotified: false,
      expiresAt: {
        not: null,
        lte: threeDaysFromNow,
        gt: new Date(), // not already expired
      },
    },
  });

  for (const post of expiringPosts) {
    await createNotification(
      userId,
      "expiring",
      "Post Expiring Soon",
      `Your post "${post.title}" expires in 3 days. Renew it to keep it active.`,
      `/posts/${post.id}`
    );
    await prisma.post.update({
      where: { id: post.id },
      data: { expirationNotified: true },
    });
  }
}

export async function renewPost(postId: string, userId: string) {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new HttpError(404, "Post not found");
  if (post.authorId !== userId) throw new HttpError(403, "Not authorized");
  if (post.status !== "active") throw new HttpError(400, "Only active posts can be renewed");

  const newExpiry = new Date();
  newExpiry.setDate(newExpiry.getDate() + APP_CONFIG.postExpirationDays);

  return prisma.post.update({
    where: { id: postId },
    data: {
      expiresAt: newExpiry,
      expirationNotified: false,
    },
  });
}
