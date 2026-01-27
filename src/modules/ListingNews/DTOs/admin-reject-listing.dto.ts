import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminRejectListingDto {
  @ApiProperty({
    example: 'Thiếu giấy tờ chứng minh nguồn gốc',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  note: string;
}
