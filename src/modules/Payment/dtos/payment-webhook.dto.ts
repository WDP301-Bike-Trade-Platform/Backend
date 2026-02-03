import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class WebhookDataDto {
  @ApiProperty({ example: 123 })
  @IsNumber()
  orderCode: number;

  @ApiProperty({ example: 3000 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'VQRIO123' })
  @IsString()
  description: string;

  @ApiProperty({ example: '12345678' })
  @IsString()
  accountNumber: string;

  @ApiProperty({ example: 'TF230204212323' })
  @IsString()
  reference: string;

  @ApiProperty({ example: '2023-02-04 18:25:00' })
  @IsString()
  transactionDateTime: string;

  @ApiProperty({ example: '124c33293c43417ab7879e14c8d9eb18' })
  @IsString()
  paymentLinkId: string;

  @ApiProperty({ example: '00' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Thành công' })
  @IsString()
  desc: string;

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

  @ApiProperty({ example: 'VND' })
  @IsString()
  currency: string;
}

export class PaymentWebhookDto {
  @ApiProperty({ example: '00' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'success' })
  @IsString()
  desc: string;

  @ApiProperty({ type: WebhookDataDto })
  @IsObject()
  @ValidateNested()
  @Type(() => WebhookDataDto)
  data: WebhookDataDto;

  @ApiProperty({ example: '4a236c5a76e0df5f1502b18e7b7488b9b0598f5ba1089a2b2db318c6a71857e4' })
  @IsString()
  signature: string;
}
