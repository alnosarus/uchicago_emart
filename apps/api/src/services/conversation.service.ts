import { prisma } from "../config/database";
import { HttpError } from "../utils/errors";

export async function getConversations(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ participant1Id: userId }, { participant2Id: userId }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      participant1: { select: { id: true, name: true, avatarUrl: true } },
      participant2: { select: { id: true, name: true, avatarUrl: true } },
      post: {
        select: {
          id: true,
          title: true,
          marketplace: { select: { priceAmount: true } },
          storage: { select: { priceMonthly: true } },
          housing: { select: { monthlyRent: true } },
          images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderId: true, createdAt: true },
      },
    },
  });

  return {
    data: conversations.map((conv) => {
      const isParticipant1 = conv.participant1Id === userId;
      const other = isParticipant1 ? conv.participant2 : conv.participant1;
      const lastMessage = conv.messages[0] ?? null;

      const price =
        conv.post.marketplace?.priceAmount ??
        conv.post.storage?.priceMonthly ??
        conv.post.housing?.monthlyRent ??
        null;

      return {
        id: conv.id,
        postId: conv.postId,
        otherParticipant: {
          id: other.id,
          name: other.name,
          avatarUrl: other.avatarUrl,
        },
        post: {
          id: conv.post.id,
          title: conv.post.title,
          price,
          imageUrl: conv.post.images[0]?.url ?? null,
        },
        lastMessage: lastMessage
          ? { body: lastMessage.body, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt }
          : null,
        unreadCount: 0, // filled below
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
      };
    }),
  };
}

export async function getConversationsWithUnread(userId: string) {
  const result = await getConversations(userId);

  // Batch fetch unread counts
  const convIds = result.data.map((c) => c.id);
  if (convIds.length > 0) {
    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: convIds },
        senderId: { not: userId },
        readAt: null,
      },
      _count: { id: true },
    });

    const countMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));
    for (const conv of result.data) {
      conv.unreadCount = countMap.get(conv.id) ?? 0;
    }
  }

  return result;
}

export async function createConversation(userId: string, postId: string) {
  // Verify post exists and is active
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, status: true },
  });

  if (!post) {
    throw new HttpError(404, "Post not found");
  }
  if (post.authorId === userId) {
    throw new HttpError(409, "Cannot message yourself about your own post");
  }
  if (post.status !== "active") {
    throw new HttpError(400, "Cannot start a conversation on an inactive post");
  }

  // Check for existing conversation
  const existing = await prisma.conversation.findFirst({
    where: {
      postId,
      participant1Id: userId,
      participant2Id: post.authorId,
    },
  });

  if (existing) {
    return { conversation: existing, created: false };
  }

  const conversation = await prisma.conversation.create({
    data: {
      postId,
      participant1Id: userId,
      participant2Id: post.authorId,
    },
  });

  return { conversation, created: true };
}

export async function getConversation(conversationId: string, userId: string) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participant1: { select: { id: true, name: true, avatarUrl: true } },
      participant2: { select: { id: true, name: true, avatarUrl: true } },
      post: {
        select: {
          id: true,
          title: true,
          marketplace: { select: { priceAmount: true } },
          storage: { select: { priceMonthly: true } },
          housing: { select: { monthlyRent: true } },
          images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
        },
      },
    },
  });

  if (!conv) {
    throw new HttpError(404, "Conversation not found");
  }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    throw new HttpError(403, "Not a participant in this conversation");
  }

  const isParticipant1 = conv.participant1Id === userId;
  const other = isParticipant1 ? conv.participant2 : conv.participant1;

  const price =
    conv.post.marketplace?.priceAmount ??
    conv.post.storage?.priceMonthly ??
    conv.post.housing?.monthlyRent ??
    null;

  const unreadCount = await prisma.message.count({
    where: { conversationId, senderId: { not: userId }, readAt: null },
  });

  return {
    id: conv.id,
    postId: conv.postId,
    otherParticipant: { id: other.id, name: other.name, avatarUrl: other.avatarUrl },
    post: {
      id: conv.post.id,
      title: conv.post.title,
      price,
      imageUrl: conv.post.images[0]?.url ?? null,
    },
    lastMessage: null,
    unreadCount,
    updatedAt: conv.updatedAt,
    createdAt: conv.createdAt,
  };
}

export async function getMessages(
  conversationId: string,
  userId: string,
  options: { before?: string; limit: number }
) {
  // Verify participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant1Id: true, participant2Id: true },
  });

  if (!conv) {
    throw new HttpError(404, "Conversation not found");
  }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    throw new HttpError(403, "Not a participant in this conversation");
  }

  const where: Record<string, unknown> = { conversationId };

  if (options.before) {
    const cursor = await prisma.message.findUnique({
      where: { id: options.before },
      select: { createdAt: true },
    });
    if (cursor) {
      where.createdAt = { lt: cursor.createdAt };
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit + 1, // fetch one extra to determine hasMore
  });

  const hasMore = messages.length > options.limit;
  if (hasMore) messages.pop();

  return { data: messages.reverse(), hasMore };
}

export async function sendMessage(conversationId: string, userId: string, body: string) {
  // Verify participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant1Id: true, participant2Id: true },
  });

  if (!conv) {
    throw new HttpError(404, "Conversation not found");
  }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    throw new HttpError(403, "Not a participant in this conversation");
  }

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: userId, body },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  // Determine recipient
  const recipientId =
    conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

  // Create notification (don't fail send if notification fails)
  const { createNotification } = await import("./notification.service");
  await createNotification(
    recipientId,
    "message",
    "New Message",
    body.length > 100 ? body.slice(0, 100) + "..." : body,
    `/messages?conversation=${conversationId}`
  ).catch(() => {});

  return { message, recipientId };
}

export async function markRead(conversationId: string, userId: string) {
  // Verify participant
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { participant1Id: true, participant2Id: true },
  });

  if (!conv) {
    throw new HttpError(404, "Conversation not found");
  }
  if (conv.participant1Id !== userId && conv.participant2Id !== userId) {
    throw new HttpError(403, "Not a participant in this conversation");
  }

  const now = new Date();

  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: now },
  });

  const otherUserId =
    conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

  return { readAt: now, otherUserId };
}

export async function getTotalUnreadCount(userId: string): Promise<number> {
  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [{ participant1Id: userId }, { participant2Id: userId }],
    },
    select: { id: true },
  });

  if (conversations.length === 0) return 0;

  return prisma.message.count({
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderId: { not: userId },
      readAt: null,
    },
  });
}
