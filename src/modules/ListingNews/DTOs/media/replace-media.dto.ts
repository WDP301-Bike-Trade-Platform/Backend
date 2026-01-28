import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReplaceMediaDto {
  @ApiProperty({
    example: 'https://example.com/images/new-bike.jpg',
    description: 'Đường dẫn file mới',
  })
  @IsString()
  @IsNotEmpty()
  file_url: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type của file mới',
  })
  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @ApiProperty({
    example: 3456789,
    description: 'Dung lượng file mới (bytes)',
  })
  @IsNumber()
  size_bytes: number;
}
