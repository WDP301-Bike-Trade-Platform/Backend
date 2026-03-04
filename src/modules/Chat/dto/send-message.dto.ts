import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Nội dung tin nhắn' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'URL hình ảnh đính kèm' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
