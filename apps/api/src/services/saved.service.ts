import { prisma } from "../config/database";

export async function savePost(userId: string, postId: string) {
  await prisma.savedPost.upsert({
    where: { userId_postId: { userId, postId } },
    update: {},
    create: { userId, postId },
  });

  // Notify the post author (don't notify if saving own post)
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true, title: true },
  });
  if (post && post.authorId !== userId) {
    const { createNotification } = await import("./notification.service");
    await createNotification(
      post.authorId,
      "save",
      "Post Saved",
      `Someone saved your post "${post.title}"`,
      `/posts/${postId}`
    ).catch(() => {}); // Don't fail the save if notification fails
  }
}

export async function unsavePost(userId: string, postId: string) {
  await prisma.savedPost.deleteMany({ where: { userId, postId } });
}

export async function getSavedPosts(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;

  const [savedPosts, total] = await Promise.all([
    prisma.savedPost.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        post: {
          include: {
            author: { select: { id: true, name: true, avatarUrl: true, isVerified: true } },
            marketplace: true,
            storage: true,
            housing: true,
            images: { orderBy: { order: "asc" }, take: 1 },
          },
        },
      },
    }),
    prisma.savedPost.count({ where: { userId } }),
  ]);

  return { data: savedPosts.map((sp) => sp.post), total };
}

export async function getSavedPostIds(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();

  const saved = await prisma.savedPost.findMany({
    where: { userId, postId: { in: postIds } },
    select: { postId: true },
  });

  return new Set(saved.map((s) => s.postId));
}
