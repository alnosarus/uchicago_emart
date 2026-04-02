-- CreateEnum
CREATE TYPE "HousingSubtype" AS ENUM ('sublet', 'passdown');

-- CreateEnum
CREATE TYPE "HousingSide" AS ENUM ('offering', 'looking');

-- CreateEnum
CREATE TYPE "Bedrooms" AS ENUM ('studio', '1', '2', '3_plus');

-- CreateEnum
CREATE TYPE "Bathrooms" AS ENUM ('1', '1.5', '2_plus');

-- CreateEnum
CREATE TYPE "RoommateType" AS ENUM ('solo', 'shared');

-- AlterEnum
ALTER TYPE "PostType" ADD VALUE 'housing';

-- AlterEnum
ALTER TYPE "PostSide" ADD VALUE 'offering';
ALTER TYPE "PostSide" ADD VALUE 'looking';

-- CreateTable
CREATE TABLE "housing_details" (
    "postId" TEXT NOT NULL,
    "subtype" "HousingSubtype" NOT NULL,
    "side" "HousingSide" NOT NULL,
    "monthly_rent" DOUBLE PRECISION NOT NULL,
    "bedrooms" "Bedrooms" NOT NULL,
    "bathrooms" "Bathrooms" NOT NULL,
    "neighborhood" TEXT,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roommates" "RoommateType" NOT NULL,
    "roommate_count" INTEGER,
    "move_in_date" TIMESTAMP(3),
    "move_out_date" TIMESTAMP(3),
    "lease_start_date" TIMESTAMP(3),
    "lease_duration_months" INTEGER,

    CONSTRAINT "housing_details_pkey" PRIMARY KEY ("postId")
);

-- AddForeignKey
ALTER TABLE "housing_details" ADD CONSTRAINT "housing_details_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
