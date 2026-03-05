// dto/search/product-search.dto.ts
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductSearchQuery {
  @ApiPropertyOptional({ description: 'Từ khóa tìm kiếm (brand, model, description)' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'ID của danh mục' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Khoảng giá, định dạng "min-max", ví dụ: 1000-5000' })
  @IsOptional()
  @IsString()
  price_range?: string;

  @ApiPropertyOptional({ description: 'Thành phố của người bán' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}