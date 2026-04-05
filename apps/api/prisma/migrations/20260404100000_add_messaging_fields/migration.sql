-- AlterTable: add updatedAt to conversations
ALTER TABLE "conversations" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: add readAt to messages
ALTER TABLE "messages" ADD COLUMN "read_at" TIMESTAMP(3);
