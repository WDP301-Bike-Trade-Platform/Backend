import { IsUUID, IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus, ReportResolution } from '@prisma/client';

export class CreateReportDto {
  @ApiProperty({ description: 'ID của tin cần báo cáo' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ description: 'Lý do báo cáo', minLength: 5 })
  @IsString()
  @MinLength(5)
  reason: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateReportDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ enum: ReportResolution })
  @IsOptional()
  @IsEnum(ReportResolution)
  resolution?: ReportResolution;

  @ApiPropertyOptional({ description: 'Ghi chú của admin' })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class ReportQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @ApiPropertyOptional({ default: 1 })
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  limit?: number = 10;
}