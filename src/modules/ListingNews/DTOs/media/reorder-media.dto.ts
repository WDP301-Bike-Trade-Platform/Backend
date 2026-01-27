import { IsArray, IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderMediaItemDto {
  @ApiProperty({
    example: 'media_123',
    description: 'ID của media',
  })
  @IsString()
  media_id: string;

  @ApiProperty({
    example: 1,
    description: 'Vị trí mới của media trong danh sách',
  })
  @IsInt()
  position: number;
}

export class ReorderMediaDto {
  @ApiProperty({
    type: [ReorderMediaItemDto],
    example: [
      { media_id: 'media_123', position: 1 },
      { media_id: 'media_456', position: 2 },
    ],
    description: 'Danh sách media cùng vị trí mới',
  })
  @IsArray()
  orders: ReorderMediaItemDto[];
}
