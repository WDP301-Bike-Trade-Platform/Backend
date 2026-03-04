-- CreateTable
CREATE TABLE "chats" (
    "chat_id" TEXT NOT NULL,
    "user1_id" TEXT NOT NULL,
    "user2_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("chat_id")
);

-- AlterTable: make receiver_id optional
ALTER TABLE "messages" ALTER COLUMN "receiver_id" DROP NOT NULL;

-- AlterTable: make content optional
ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL;

-- AlterTable: add chat_id column
ALTER TABLE "messages" ADD COLUMN "chat_id" TEXT;

-- AlterTable: add image_url column
ALTER TABLE "messages" ADD COLUMN "image_url" TEXT;

-- AlterTable: set default for created_at
ALTER TABLE "messages" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("chat_id") ON DELETE SET NULL ON UPDATE CASCADE;
