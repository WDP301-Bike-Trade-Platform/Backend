import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID của user nhận thông báo' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Tiêu đề thông báo' })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ description: 'Nội dung thông báo' })
  @IsString()
  @MinLength(1)
  message: string;

  @ApiPropertyOptional({ description: 'Loại thông báo', enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional({ description: 'Link đính kèm' })
  @IsOptional()
  @IsString()
  link?: string;
}
