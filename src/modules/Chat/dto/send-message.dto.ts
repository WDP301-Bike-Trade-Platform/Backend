import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsUUID } from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Loại tin nhắn (mặc định TEXT)', enum: MessageType })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ description: 'ID của lời trả giá (Nếu type là OFFER)' })
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ description: 'Nội dung tin nhắn' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'URL hình ảnh đính kèm' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}
