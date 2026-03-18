// shipping.dto.ts
import { IsUUID, IsOptional, IsString, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ShipmentStatus } from '@prisma/client';

// 👇 Định nghĩa ShipmentTrackingDto trước
export class ShipmentTrackingDto {
  @ApiProperty()
  trackingId: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ nullable: true })
  location: string | null;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty()
  trackedAt: Date;
}

// 👇 Sau đó mới dùng nó trong ShipmentResponseDto
export class ShipmentResponseDto {
  @ApiProperty()
  shipmentId: string;

  @ApiProperty()
  orderId: string;

  @ApiProperty({ nullable: true })
  trackingNumber: string | null;

  @ApiProperty({ nullable: true })
  carrier: string | null;

  @ApiProperty({ enum: ShipmentStatus })
  status: ShipmentStatus;

  @ApiProperty()
  shippingFee: number;

  @ApiProperty({ nullable: true })
  estimatedDelivery: Date | null;

  @ApiProperty({ nullable: true })
  deliveredAt: Date | null;

  @ApiProperty({ nullable: true })
  shippedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [ShipmentTrackingDto] })
  trackings?: ShipmentTrackingDto[];
}

export class ManualUpdateStatusDto {
  @ApiProperty({ enum: ShipmentStatus, description: 'Trạng thái mới của shipment' })
  @IsEnum(ShipmentStatus)
  status: ShipmentStatus;

  @ApiPropertyOptional({ description: 'Địa điểm cập nhật' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateShipmentDto {
  @ApiProperty({ description: 'ID của đơn hàng' })
  @IsUUID()
  orderId: string;
}

export class ShipmentQueryDto {
  @ApiPropertyOptional({ description: 'Số bản ghi bỏ qua' })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  skip?: number;

  @ApiPropertyOptional({ description: 'Số bản ghi lấy', default: 10 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  take?: number = 10;

  @ApiPropertyOptional({ enum: ShipmentStatus, description: 'Lọc theo trạng thái' })
  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}