import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ description: 'ID của listing muốn đặt hàng' })
  @IsNotEmpty()
  @IsString()
  listingId: string;

  @ApiPropertyOptional({ description: 'ID của địa chỉ giao hàng (tùy chọn)' })
  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ApiPropertyOptional({ description: 'Ghi chú cho đơn hàng' })
  @IsOptional()
  @IsString()
  note?: string;
}
