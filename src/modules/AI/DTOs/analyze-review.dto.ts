import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AnalyzeReviewDto {
  @ApiProperty({ description: 'ID của đánh giá (nếu có)', required: false, example: 'review-789' })
  @IsOptional()
  @IsString()
  reviewId?: string;

  @ApiProperty({ description: 'Nội dung đánh giá (nếu chưa có reviewId)', required: false, example: 'Xe rất tốt, giao hàng nhanh' })
  @IsOptional()
  @IsString()
  comment?: string;
}