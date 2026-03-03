export interface TransferTransactionResponse {
  transferTransactionId: string;
  referenceId: string;
  payoutTransactionId?: string | null;
  amount: number;
  description: string;
  toBin: string;
  toAccountNumber: string;
  toAccountName?: string | null;
  reference?: string | null;
  transactionDatetime?: Date | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  state: string;
}

export interface TransferResponse {
  transferId: string;
  referenceId: string;
  payoutId?: string | null;
  totalCredit?: number | null;
  category?: string[] | null;
  approvalState: string;
  createdAt: Date;
  updatedAt?: Date | null;
  transactions: TransferTransactionResponse[];
}
