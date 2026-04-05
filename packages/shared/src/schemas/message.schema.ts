import { z } from "zod";

export const createConversationSchema = z.object({
  postId: z.string().uuid(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messagesPaginationSchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export type MessagesPaginationInput = z.infer<typeof messagesPaginationSchema>;
