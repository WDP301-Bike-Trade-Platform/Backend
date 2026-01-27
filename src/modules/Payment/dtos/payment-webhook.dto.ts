import { ApiProperty } from '@nestjs/swagger';

export class PaymentWebhookDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  desc: string;

  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    counterAccountBankId?: string;
    counterAccountBankName?: string;
    counterAccountName?: string;
    counterAccountNumber?: string;
    virtualAccountName?: string;
    virtualAccountNumber?: string;
  };

  @ApiProperty()
  signature: string;
}
