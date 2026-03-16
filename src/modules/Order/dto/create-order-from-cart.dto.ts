import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsNotEmpty } from 'class-validator';
import { SUPPORTED_PAYMENT_METHODS } from '../order.constants';
import type { SupportedPaymentMethod } from '../order.constants';

export class CreateOrderFromCartDto {
  @ApiProperty({
    description: 'Phương thức thanh toán áp dụng cho toàn bộ đơn hàng trong giỏ',
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

  @ApiPropertyOptional({ description: 'Cờ xác định lệnh thanh toán đặt cọc 10%' })
  @IsOptional()
  isDeposit?: boolean;
}
