-- AlterTable
ALTER TABLE "vehicles"
    ALTER COLUMN "bike_type" TYPE TEXT USING "bike_type"::text,
    ALTER COLUMN "material" TYPE TEXT USING "material"::text,
    ALTER COLUMN "brake_type" TYPE TEXT USING "brake_type"::text,
    ALTER COLUMN "usage_level" TYPE TEXT USING "usage_level"::text;

-- DropEnum
DROP TYPE IF EXISTS "BikeType";
DROP TYPE IF EXISTS "FrameMaterial";
DROP TYPE IF EXISTS "BrakeType";
DROP TYPE IF EXISTS "UsageLevel";
