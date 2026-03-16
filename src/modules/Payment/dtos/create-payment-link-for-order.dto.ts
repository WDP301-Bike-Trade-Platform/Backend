import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class CreatePaymentLinkForOrderDto {
  @ApiProperty({ description: 'ID của order cần thanh toán' })
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @ApiProperty({ description: 'Giai đoạn thanh toán', enum: ['DEPOSIT', 'REMAINING'], required: false })
  @IsOptional()
  @IsEnum(['DEPOSIT', 'REMAINING'])
  paymentStage?: 'DEPOSIT' | 'REMAINING';

  @ApiProperty({ description: 'Nền tảng thanh toán', enum: ['WEB', 'MOBILE'], required: false })
  @IsOptional()
  @IsEnum(['WEB', 'MOBILE'])
  platform?: 'WEB' | 'MOBILE';
}
