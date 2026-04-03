-- Add cnet_id to users: nullable first, backfill, then make NOT NULL + unique
ALTER TABLE "users" ADD COLUMN "cnet_id" TEXT;
UPDATE "users" SET "cnet_id" = split_part("email", '@', 1);
ALTER TABLE "users" ALTER COLUMN "cnet_id" SET NOT NULL;
CREATE UNIQUE INDEX "users_cnet_id_key" ON "users"("cnet_id");

-- Add unique constraint to reviews (one review per reviewer per post)
CREATE UNIQUE INDEX "reviews_post_id_reviewer_id_key" ON "reviews"("post_id", "reviewer_id");

-- Create transactions table
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on post_id (one transaction per post)
CREATE UNIQUE INDEX "transactions_post_id_key" ON "transactions"("post_id");

-- Add indexes for seller and buyer lookups
CREATE INDEX "transactions_seller_id_idx" ON "transactions"("seller_id");
CREATE INDEX "transactions_buyer_id_idx" ON "transactions"("buyer_id");

-- Add foreign keys
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
