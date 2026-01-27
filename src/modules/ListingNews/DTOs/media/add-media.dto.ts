import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MediaType } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class AddMediaItemDto {
  @ApiProperty({
    example: 'https://example.com/images/bike1.jpg',
    description: 'Đường dẫn file (ảnh, video, pdf, …)',
  })
  @IsString()
  @IsNotEmpty()
  file_url: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type của file',
  })
  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @ApiProperty({
    example: 2456789,
    description: 'Dung lượng file tính bằng byte',
  })
  @IsNumber()
  size_bytes: number; // FE gửi number, service cast -> BigInt

  @ApiProperty({
    example: 'IMAGE',
    enum: MediaType,
    description: 'Loại media (IMAGE, VIDEO, DOCUMENT, …)',
  })
  @IsEnum(MediaType)
  media_type: MediaType;
}

export class AddMediaDto {
  @ApiProperty({
    type: [AddMediaItemDto],
    example: [
      {
        file_url: 'https://example.com/images/bike1.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 2456789,
        media_type: 'IMAGE',
      },
      {
        file_url: 'https://example.com/videos/bike-demo.mp4',
        mime_type: 'video/mp4',
        size_bytes: 104567890,
        media_type: 'VIDEO',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  files: AddMediaItemDto[];
}
