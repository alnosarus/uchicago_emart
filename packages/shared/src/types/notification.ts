export type NotificationType =
  | "message"
  | "review"
  | "save"
  | "match"
  | "expiring"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}
