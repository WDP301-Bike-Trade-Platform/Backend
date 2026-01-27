import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BikeType, BrakeType, FrameMaterial, UsageLevel } from '@prisma/client';

export class UpdateListingDto {
  // ===== Price / description =====
  @ApiPropertyOptional({ example: 8200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ example: 'Xe đi ít, mới bảo dưỡng' })
  @IsOptional()
  @IsString()
  description?: string;

  // ===== Bike-specific =====
  @ApiPropertyOptional({ enum: BikeType })
  @IsOptional()
  @IsEnum(BikeType)
  bike_type?: BikeType;

  @ApiPropertyOptional({ enum: FrameMaterial })
  @IsOptional()
  @IsEnum(FrameMaterial)
  material?: FrameMaterial;

  @ApiPropertyOptional({ enum: BrakeType })
  @IsOptional()
  @IsEnum(BrakeType)
  brake_type?: BrakeType;

  @ApiPropertyOptional({ example: '700c' })
  @IsOptional()
  @IsString()
  wheel_size?: string;

  @ApiPropertyOptional({ enum: UsageLevel })
  @IsOptional()
  @IsEnum(UsageLevel)
  usage_level?: UsageLevel;

  @ApiPropertyOptional({ example: 1500 })
  @IsOptional()
  @IsInt()
  @Min(0)
  mileage_km?: number;

  // ===== Extra info =====
  @ApiPropertyOptional({ example: 'Shimano 105' })
  @IsOptional()
  @IsString()
  groupset?: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  frame_size?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_original?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  has_receipt?: boolean;

  @ApiPropertyOptional({ example: 'SN123456789' })
  @IsOptional()
  @IsString()
  frame_serial?: string;

  // ===== Images (replace all) =====
  @ApiPropertyOptional({
    type: [String],
    example: ['https://img1.jpg', 'https://img2.jpg', 'https://img3.jpg'],
    description: 'Nếu gửi images thì bắt buộc ≥ 3 ảnh',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3, { message: 'Phải có ít nhất 3 hình ảnh' })
  images?: string[];
}
