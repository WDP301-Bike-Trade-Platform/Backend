import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiPropertyOptional({
    example: 'uuid-category',
    description: 'ID danh mục, nếu không truyền sẽ fallback về "Khác"',
  })
  @IsOptional()
  @IsString()
  category_id?: string;

  @ApiProperty({
    example: 'Honda',
  })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({
    example: 'Wave Alpha 110',
  })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({
    example: 18000000,
  })
  @IsNumber()
  price: number;

  @ApiPropertyOptional({
    example: 'Xe chính chủ, máy zin',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    type: [String],
    example: [
      'https://img1.jpg',
      'https://img2.jpg',
      'https://img3.jpg',
    ],
    description: 'Danh sách ảnh (tối thiểu 3 ảnh)',
  })
  @IsArray()
  @ArrayMinSize(3, { message: 'Tin đăng phải có tối thiểu 3 ảnh' })
  images: string[];
}
