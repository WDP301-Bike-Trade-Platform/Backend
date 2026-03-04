import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { SUPPORTED_PAYMENT_METHODS } from '../order.constants';
import type { SupportedPaymentMethod } from '../order.constants';

export class CreateOrderDto {
  @ApiProperty({ description: 'ID của listing muốn đặt hàng' })
  @IsNotEmpty()
  @IsString()
  listingId: string;

  @ApiProperty({
    description: 'Phương thức thanh toán mong muốn',
    enum: SUPPORTED_PAYMENT_METHODS,
  })
  @IsNotEmpty()
  @IsString()
  @IsIn(SUPPORTED_PAYMENT_METHODS)
  paymentMethod: SupportedPaymentMethod;

  @ApiPropertyOptional({ description: 'ID của địa chỉ giao hàng (tùy chọn)' })
  @IsOptional()
  @IsString()
  shippingAddressId?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ giao hàng tuỳ chỉnh nếu không dùng address book' })
  @IsOptional()
  @IsString()
  deliveryAddress?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ khi giao hàng' })
  @IsOptional()
  @IsString()
  deliveryPhone?: string;

  @ApiPropertyOptional({ description: 'Ghi chú cho đơn hàng' })
  @IsOptional()
  @IsString()
  note?: string;
}
