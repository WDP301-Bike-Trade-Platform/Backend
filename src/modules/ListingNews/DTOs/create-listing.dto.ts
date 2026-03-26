import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  // ===== Category =====
  @ApiPropertyOptional({ example: '3a5d65d6-fec9-4b8c-9fb1-ee45fa242f3e' })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiProperty({ example: 'Giant Escape 3 bicycle for sale.' })
  @IsString()
  @IsNotEmpty()
  title: string;

  // ===== Vehicle core =====
  @ApiProperty({ example: 'Giant' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'Escape 3' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2021 })
  @IsInt()
  @Min(1990)
  year: number;

  @ApiProperty({ example: 8500000 })
  @IsNumber()
  price: number;

  // ===== Bike-specific =====
  @ApiProperty({ example: 'Xe đạp road / fixed / custom' })
  @IsString()
  @IsNotEmpty()
  bike_type: string;

  @ApiProperty({ example: 'Carbon, Aluminum, Thép hoặc tuỳ chọn' })
  @IsString()
  @IsNotEmpty()
  material: string;

  @ApiProperty({ example: 'Disc, Rim, Hydraulic...' })
  @IsString()
  @IsNotEmpty()
  brake_type: string;

  @ApiPropertyOptional({ example: '700c' })
  @IsOptional()
  @IsString()
  wheel_size?: string;

  @ApiPropertyOptional({ example: 'Light, Medium, Heavy, Custom' })
  @IsOptional()
  @IsString()
  usage_level?: string;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @IsInt()
  mileage_km?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frame_serial?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  // ===== Images =====
  @ApiProperty({
    type: [String],
    example: ['https://img1.jpg', 'https://img2.jpg'],
  })
  @IsArray()
  @ArrayMinSize(3)
  images: string[];
}
