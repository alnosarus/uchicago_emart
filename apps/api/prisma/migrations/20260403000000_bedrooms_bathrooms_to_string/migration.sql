-- Convert bedrooms and bathrooms from enum to text
-- This avoids Prisma enum @map mismatches for values like "1", "1.5", "3_plus"
-- Zod validation at the API layer enforces allowed values

ALTER TABLE "housing_details" ALTER COLUMN "bedrooms" TYPE TEXT USING "bedrooms"::TEXT;
ALTER TABLE "housing_details" ALTER COLUMN "bathrooms" TYPE TEXT USING "bathrooms"::TEXT;

-- Drop the unused enum types
DROP TYPE IF EXISTS "Bedrooms";
DROP TYPE IF EXISTS "Bathrooms";
