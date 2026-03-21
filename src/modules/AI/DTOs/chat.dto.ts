import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class ChatDto {
  @ApiProperty({ description: 'Tin nhắn của người dùng', example: 'Xe này còn không ạ?' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'ID của sản phẩm đang hỏi (nếu có)', required: false, example: 'abc-123' })
  @IsOptional()
  @IsString()
  listingId?: string;

  @ApiProperty({ description: 'ID của cuộc hội thoại (nếu có)', required: false, example: 'chat-456' })
  @IsOptional()
  @IsString()
  chatId?: string;
}