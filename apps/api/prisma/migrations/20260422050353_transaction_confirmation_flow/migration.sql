/*
  Warnings:

  - You are about to drop the column `completed_at` on the `transactions` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'completed', 'expired');

-- AlterEnum
ALTER TYPE "PostStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "completed_at",
ADD COLUMN     "buyer_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmed_at" TIMESTAMP(3),
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "initiated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "seller_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'pending';

-- Backfill existing transactions as fully confirmed
UPDATE "transactions" SET
  "status" = 'completed',
  "seller_confirmed" = true,
  "buyer_confirmed" = true,
  "confirmed_at" = "initiated_at"
WHERE "status" = 'pending';

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
