import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min } from 'class-validator';

export class CreateOfferDto {
  @ApiProperty({ description: 'ID của Listing (Sản phẩm)' })
  @IsUUID()
  listingId: string;

  @ApiProperty({ description: 'Số tiền muốn trả giá' })
  @IsNumber()
  @Min(1000)
  offeredPrice: number;
}
