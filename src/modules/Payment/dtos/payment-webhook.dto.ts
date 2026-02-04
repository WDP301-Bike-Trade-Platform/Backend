import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WebhookDataDto {
  @ApiProperty()
  @IsNumber()
  orderCode: number;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  accountNumber: string;

  @ApiProperty()
  @IsString()
  reference: string;

  @ApiProperty()
  @IsString()
  transactionDateTime: string;

  @ApiProperty()
  @IsString()
  paymentLinkId: string;

  @ApiProperty({ example: '00' })
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  desc?: string;

  @ApiProperty({ example: '', required: false })
  @IsString()
  @IsOptional()
  counterAccountBankId?: string;

  @ApiProperty({ example: '', required: false })
  @IsString()
  @IsOptional()
  counterAccountBankName?: string;

  @ApiProperty({ example: '', required: false })
  @IsString()
  @IsOptional()
  counterAccountName?: string;

  @ApiProperty({ example: '', required: false })
  @IsString()
  @IsOptional()
  counterAccountNumber?: string;

  @ApiProperty({ example: '', required: false })
  @IsString()
  @IsOptional()
  virtualAccountName?: string;

  @ApiProperty({ example: '', required: false })
  @IsString()
  @IsOptional()
  virtualAccountNumber?: string;

  @ApiProperty({ })
  @IsString()
  currency: string;
}

export class PaymentWebhookDto {
  @ApiProperty({})
  @IsString()
  code: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  desc?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  success?: boolean;

  @ApiProperty({ type: WebhookDataDto })
  @IsObject()
  @ValidateNested()
  @Type(() => WebhookDataDto)
  data: WebhookDataDto;

  @ApiProperty()
  @IsString()
  signature: string;
}
