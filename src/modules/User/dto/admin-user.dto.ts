import { IsOptional, IsInt, IsEnum, IsDateString, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '@prisma/client';

export enum UserStatusFilter {
  ACTIVE = 'active',
  LOCKED = 'locked',
  ALL = 'all',
}

export class AdminUserQueryDto {
  @ApiPropertyOptional({ enum: RoleName, description: 'Lọc theo vai trò' })
  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @ApiPropertyOptional({ enum: UserStatusFilter, description: 'Trạng thái tài khoản' })
  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter;

  @ApiPropertyOptional({ description: 'Ngày tham gia từ (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'Ngày tham gia đến (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên hoặc email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({ description: 'Thời gian khóa đến (ISO string). Để null để mở khóa.', example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  lockedUntil?: string | null;

  @ApiPropertyOptional({ description: 'Lý do khóa/mở khóa (gửi email/thông báo)' })
  @IsOptional()
  @IsString()
  reason?: string;
}