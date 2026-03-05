import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddWishlistDto {
  @ApiProperty({ description: 'ID của listing cần thêm vào wishlist' })
  @IsUUID()
  @IsNotEmpty()
  listingId: string;
}