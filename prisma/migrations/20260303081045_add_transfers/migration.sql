-- AlterTable
ALTER TABLE "transfers" ALTER COLUMN "updated_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN "bank_bin" TEXT;
