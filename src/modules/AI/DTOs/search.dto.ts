import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class SearchDto {
  @ApiProperty({ description: 'Câu truy vấn tìm kiếm', example: 'xe đạp địa hình dưới 10 triệu' })
  @IsString()
  query: string;

  @ApiProperty({ description: 'Số lượng kết quả trả về (mặc định 20, tối đa 100)', required: false, example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}