import { IsUUID, IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Tên danh mục' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'ID danh mục cha (bỏ trống nếu là danh mục gốc)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Tên danh mục' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'ID danh mục cha (null để chuyển thành danh mục gốc)' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}

export class CategoryQueryDto {
  @ApiPropertyOptional({ description: 'Lọc theo danh mục cha (dùng "null" để lấy danh mục gốc)' })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Trả về dạng cây (true) hoặc danh sách phẳng (false)', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  tree?: boolean = true;

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