import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePaymentLinkForOrderDto {
  @ApiProperty({ description: 'ID của order cần thanh toán' })
  @IsNotEmpty()
  @IsString()
  orderId: string;
}
