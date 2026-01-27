import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
} from 'class-validator';

export class CreatePaymentLinkDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID của listing/vehicle cần thanh toán',
  })
  @IsUUID()
  listingId: string;
}
