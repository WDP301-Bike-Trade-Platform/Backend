import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, Min, IsOptional } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({ description: 'ID của listing muốn thêm vào giỏ hàng' })
  @IsNotEmpty()
  @IsString()
  listingId: string;

  @ApiProperty({ description: 'Số lượng', default: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number = 1;
}
