import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminUpdateOrderStatusDto {
  @ApiProperty({
    description:
      'Trạng thái mới: PENDING | DEPOSITED | CONFIRMED | COMPLETED | CANCELLED',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiPropertyOptional({ description: 'Lý do thay đổi trạng thái' })
  @IsOptional()
  @IsString()
  reason?: string;
}
