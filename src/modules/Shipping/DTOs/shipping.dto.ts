// shipping.dto.ts (bổ sung)
import { IsUUID, IsOptional, IsString, IsEnum, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ShipmentStatus } from '@prisma/client';

export class ShipmentResponseDto {
  shipmentId: string;
  orderId: string;
  trackingNumber: string | null;
  carrier: string | null;
  status: ShipmentStatus;
  shippingFee: number;
  estimatedDelivery: Date | null;
  deliveredAt: Date | null;
  shippedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  trackings?: ShipmentTrackingDto[];
}

export class ShipmentTrackingDto {
  trackingId: string;
  status: string;
  location: string | null;
  description: string | null;
  trackedAt: Date;
}

export class ManualUpdateStatusDto {
  @IsEnum(ShipmentStatus)
  status: ShipmentStatus;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateShipmentDto {
  @IsUUID()
  orderId: string;
}

// DTO cho query danh sách shipments
export class ShipmentQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  skip?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  take?: number;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;
}