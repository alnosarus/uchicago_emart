-- AlterTable
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "housing_details" ADD COLUMN IF NOT EXISTS "place_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "housing_details_latitude_longitude_idx" ON "housing_details"("latitude", "longitude");
