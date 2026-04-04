-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "post_images" ADD COLUMN "blur_hash" TEXT,
ADD COLUMN "full_url" TEXT,
ADD COLUMN "thumb_url" TEXT,
ADD COLUMN "status" "ImageStatus" NOT NULL DEFAULT 'processing';

-- CreateIndex
CREATE INDEX "post_images_post_id_idx" ON "post_images"("post_id");
