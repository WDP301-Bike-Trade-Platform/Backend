-- CreateTable
CREATE TABLE "transfers" (
    "transfer_id" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "payout_id" TEXT,
    "user_id" TEXT,
    "total_credit" DECIMAL(65,30),
    "category" JSONB,
    "approval_state" TEXT NOT NULL DEFAULT 'DRAFTING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("transfer_id")
);

-- CreateTable
CREATE TABLE "transfer_transactions" (
    "transfer_transaction_id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "payout_transaction_id" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT NOT NULL,
    "to_bin" TEXT NOT NULL,
    "to_account_number" TEXT NOT NULL,
    "to_account_name" TEXT,
    "reference" TEXT,
    "transaction_datetime" TIMESTAMP(3),
    "error_message" TEXT,
    "error_code" TEXT,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_transactions_pkey" PRIMARY KEY ("transfer_transaction_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_reference_id_key" ON "transfers"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "transfer_transactions_reference_id_key" ON "transfer_transactions"("reference_id");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_transactions" ADD CONSTRAINT "transfer_transactions_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "transfers"("transfer_id") ON DELETE CASCADE ON UPDATE CASCADE;
