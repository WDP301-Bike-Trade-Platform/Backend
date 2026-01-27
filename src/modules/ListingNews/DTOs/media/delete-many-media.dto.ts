import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteManyMediaDto {
  @ApiProperty({
    type: [String],
    example: ['media_123', 'media_456', 'media_789'],
    description: 'Danh sách ID media cần xóa',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  mediaIds: string[];
}
