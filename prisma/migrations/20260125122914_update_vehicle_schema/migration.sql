/*
  Warnings:

  - Added the required column `bike_type` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brake_type` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `material` to the `vehicles` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `condition` on the `vehicles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "BikeType" AS ENUM ('ROAD', 'MTB', 'FIXED', 'GRAVEL', 'FOLDING');

-- CreateEnum
CREATE TYPE "FrameMaterial" AS ENUM ('CARBON', 'ALUMINUM', 'STEEL');

-- CreateEnum
CREATE TYPE "BrakeType" AS ENUM ('DISC', 'RIM');

-- CreateEnum
CREATE TYPE "VehicleCondition" AS ENUM ('NEW', 'USED');

-- CreateEnum
CREATE TYPE "UsageLevel" AS ENUM ('LIGHT', 'MEDIUM', 'HEAVY');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "bike_type" "BikeType" NOT NULL,
ADD COLUMN     "brake_type" "BrakeType" NOT NULL,
ADD COLUMN     "frame_serial" TEXT,
ADD COLUMN     "groupset" TEXT,
ADD COLUMN     "has_receipt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_original" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_service_at" TIMESTAMP(3),
ADD COLUMN     "material" "FrameMaterial" NOT NULL,
ADD COLUMN     "mileage_km" INTEGER,
ADD COLUMN     "usage_level" "UsageLevel",
ADD COLUMN     "wheel_size" TEXT,
DROP COLUMN "condition",
ADD COLUMN     "condition" "VehicleCondition" NOT NULL,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
