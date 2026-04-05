export interface Conversation {
  id: string;
  postId: string;
  participant1Id: string;
  participant2Id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationWithDetails {
  id: string;
  postId: string;
  otherParticipant: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  post: {
    id: string;
    title: string;
    price: number | null;
    imageUrl: string | null;
  };
  lastMessage: {
    body: string;
    senderId: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
  updatedAt: Date;
  createdAt: Date;
}
