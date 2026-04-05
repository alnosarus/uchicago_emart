import type { Message, ConversationWithDetails } from "./message";

export interface ServerToClientEvents {
  new_message: (payload: {
    message: Message;
    conversationId: string;
    conversation?: ConversationWithDetails;
  }) => void;
  messages_read: (payload: {
    conversationId: string;
    readAt: string;
    readBy: string;
  }) => void;
  conversation_created: (payload: {
    conversation: ConversationWithDetails;
  }) => void;
}

export interface ClientToServerEvents {
  // No client-to-server events — all mutations go through REST
}
