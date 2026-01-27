import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CancelPaymentDto {
  @ApiProperty({ example: 123456, description: 'Mã đơn hàng' })
  @IsNumber()
  orderCode: number;

  @ApiProperty({
    example: 'Khách hàng yêu cầu hủy',
    required: false,
    description: 'Lý do hủy thanh toán',
  })
  @IsOptional()
  @IsString()
  cancellationReason?: string;
}
