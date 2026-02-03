import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ConfirmOrderDto {
  @ApiPropertyOptional({ description: 'Ghi chú khi xác nhận đơn hàng' })
  @IsOptional()
  @IsString()
  note?: string;
}
