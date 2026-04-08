import { z } from "zod";

export const createReviewSchema = z.object({
  postId: z.string().uuid(),
  revieweeId: z.string().uuid(),
  rating: z.number().multipleOf(0.5).min(0.5).max(5),
  text: z.string().max(500).nullable().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
