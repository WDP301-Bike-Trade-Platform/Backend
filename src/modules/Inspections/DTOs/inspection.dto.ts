import {
  IsUUID,
  IsOptional,
  IsDateString,
  IsString,
  IsEnum,
  IsUrl,
  IsInt,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionRequestStatus, InspectionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateInspectionDto {
  @ApiProperty({ description: 'ID của listing cần kiểm định' })
  @IsUUID()
  listingId: string;

  @ApiPropertyOptional({ description: 'Thời gian hẹn kiểm định (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateInspectionDto {
  @ApiPropertyOptional({ description: 'ID của inspector được phân công' })
  @IsOptional()
  @IsUUID()
  inspectorId?: string;

  @ApiPropertyOptional({ description: 'Thời gian hẹn kiểm định' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ enum: InspectionRequestStatus, description: 'Trạng thái yêu cầu' })
  @IsOptional()
  @IsEnum(InspectionRequestStatus)
  requestStatus?: InspectionRequestStatus;

  @ApiPropertyOptional({ enum: InspectionStatus, description: 'Kết quả kiểm định' })
  @IsOptional()
  @IsEnum(InspectionStatus)
  resultStatus?: InspectionStatus;

  @ApiPropertyOptional({ description: 'URL báo cáo' })
  @IsOptional()
  @IsUrl()
  reportUrl?: string;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Thời hạn hiệu lực của kết quả' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

export class InspectionQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo listing' })
  @IsOptional()
  @IsUUID()
  listingId?: string;

  @ApiPropertyOptional({ enum: InspectionRequestStatus })
  @IsOptional()
  @IsEnum(InspectionRequestStatus)
  requestStatus?: InspectionRequestStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class CancelInspectionDto {
  @ApiProperty({ description: 'Lý do hủy', required: true })
  @IsString()
  @IsNotEmpty()
  cancelReason: string;
}
// DTO riêng cho cập nhật báo cáo (có thể dùng lại Pick từ UpdateInspectionDto)
export class UpdateReportDto {
  @ApiPropertyOptional({ enum: InspectionStatus })
  @IsOptional()
  @IsEnum(InspectionStatus)
  resultStatus?: InspectionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  reportUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}