import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ description: 'ID của người dùng muốn chat' })
  @IsNotEmpty()
  @IsString()
  otherUserId: string;
}
