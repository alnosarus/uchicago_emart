import { z } from "zod";

export const createTransactionSchema = z.object({
  postId: z.string().uuid(),
  buyerId: z.string().uuid(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
