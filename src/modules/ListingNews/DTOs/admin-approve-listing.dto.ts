import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AdminApproveListingDto {
  @ApiPropertyOptional({
    example: 'Tin hợp lệ, đầy đủ hình ảnh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
