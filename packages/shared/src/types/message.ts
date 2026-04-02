export interface Conversation {
  id: string;
  postId: string;
  participant1Id: string;
  participant2Id: string;
  createdAt: Date;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}
