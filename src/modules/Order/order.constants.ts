export const ESCROW_RULES = {
  DEPOSIT_RATE: 0.1,
  DEPOSIT_THRESHOLD_AMOUNT: 2_000_000,
  DEPOSIT_HOLD_HOURS: 72,
} as const;

export const ORDER_RULES = {
  SELLER_CONFIRM_HOLD_HOURS: 48,
} as const;

export const SUPPORTED_PAYMENT_METHODS = ['COD', 'PAYOS'] as const;
export type SupportedPaymentMethod = (typeof SUPPORTED_PAYMENT_METHODS)[number];
