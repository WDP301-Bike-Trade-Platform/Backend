import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateOrderFromCartDto {
  @ApiPropertyOptional({ description: 'ID của địa chỉ giao hàng (tùy chọn)' })
  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ApiPropertyOptional({ description: 'Ghi chú cho đơn hàng' })
  @IsOptional()
  @IsString()
  note?: string;
}
