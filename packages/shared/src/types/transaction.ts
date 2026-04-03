export interface Transaction {
  id: string;
  postId: string;
  sellerId: string;
  buyerId: string;
  completedAt: Date;
}

export interface TransactionWithDetails extends Transaction {
  post: { id: string; title: string; type: string };
  buyer: { id: string; name: string; cnetId: string; avatarUrl: string | null };
  seller: { id: string; name: string; cnetId: string; avatarUrl: string | null };
}
