-- Change rating column from INTEGER to DOUBLE PRECISION to support half-star ratings
ALTER TABLE "reviews" ALTER COLUMN "rating" TYPE DOUBLE PRECISION;
