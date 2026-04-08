-- AlterEnum
BEGIN;
CREATE TYPE "PostSide_new" AS ENUM ('sell', 'buy', 'has_space', 'need_storage', 'offering', 'looking');
ALTER TABLE "posts" ALTER COLUMN "side" TYPE "PostSide_new" USING ("side"::text::"PostSide_new");
ALTER TYPE "PostSide" RENAME TO "PostSide_old";
ALTER TYPE "PostSide_new" RENAME TO "PostSide";
DROP TYPE "public"."PostSide_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PostType_new" AS ENUM ('marketplace', 'storage', 'housing');
ALTER TABLE "posts" ALTER COLUMN "type" TYPE "PostType_new" USING ("type"::text::"PostType_new");
ALTER TYPE "PostType" RENAME TO "PostType_old";
ALTER TYPE "PostType_new" RENAME TO "PostType";
DROP TYPE "public"."PostType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "rideshare_details" DROP CONSTRAINT "rideshare_details_post_id_fkey";

-- AlterTable
ALTER TABLE "conversations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "rideshare_details";

-- DropEnum
DROP TYPE "Airport";

-- DropEnum
DROP TYPE "Direction";
