import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';

export class RecommendationDto {
  @ApiProperty({ description: 'Số lượng gợi ý trả về (mặc định 10, tối đa 50)', required: false, example: 10 })
  @IsOptional()
  @Type(() => Number)   // 👈 thêm dòng này
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}