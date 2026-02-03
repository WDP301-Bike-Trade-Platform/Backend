import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ description: 'Lý do hủy đơn hàng' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
