/*
  Warnings:

  - You are about to drop the column `status` on the `inspections` table. All the data in the column will be lost.
  - The `status` column on the `reports` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `requested_by_id` to the `inspections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `inspections` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `reports` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InspectionRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'RESOLVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportResolution" AS ENUM ('WARNING', 'HIDE_LISTING', 'DELETE_LISTING', 'BAN_USER', 'NO_ACTION', 'OTHER');

-- AlterEnum
ALTER TYPE "ListingStatus" ADD VALUE 'RESERVED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'FORFEITED';
ALTER TYPE "OrderStatus" ADD VALUE 'CANCELLED_BY_SELLER';

-- DropForeignKey
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_inspector_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_receiver_id_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "parent_id" TEXT;

-- AlterTable
ALTER TABLE "inspections" DROP COLUMN "status",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "request_status" "InspectionRequestStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "requested_by_id" TEXT NOT NULL,
ADD COLUMN     "result_status" "InspectionStatus",
ADD COLUMN     "scheduled_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "inspector_id" DROP NOT NULL,
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "admin_notes" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "processed_at" TIMESTAMP(3),
ADD COLUMN     "processed_by" TEXT,
ADD COLUMN     "resolution" "ReportResolution",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "wishlists" (
    "wishlist_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("wishlist_id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "wishlist_item_id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "listing_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("wishlist_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_user_id_key" ON "wishlists"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlist_id_listing_id_key" ON "wishlist_items"("wishlist_id", "listing_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("wishlist_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("listing_id") ON DELETE RESTRICT ON UPDATE CASCADE;
