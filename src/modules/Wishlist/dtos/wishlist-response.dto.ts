import { ApiProperty } from '@nestjs/swagger';

class SellerInfoDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  full_name: string;

  @ApiProperty({ required: false })
  avatar_url?: string;
}

class VehicleInfoDto {
  @ApiProperty()
  brand: string;

  @ApiProperty()
  model: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  price: number;

  @ApiProperty()
  condition: string;
}

class ListingMediaDto {
  @ApiProperty()
  file_url: string;

  @ApiProperty()
  is_cover: boolean;
}

class WishlistItemDto {
  @ApiProperty()
  wishlist_item_id: string;

  @ApiProperty()
  listing_id: string;

  @ApiProperty()
  added_at: Date;

  @ApiProperty({ type: () => VehicleInfoDto })
  vehicle: VehicleInfoDto;

  @ApiProperty({ type: [ListingMediaDto] })
  media: ListingMediaDto[];

  @ApiProperty({ type: () => SellerInfoDto })
  seller: SellerInfoDto;
}

export class WishlistResponseDto {
  @ApiProperty()
  wishlist_id: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty({ type: [WishlistItemDto] })
  items: WishlistItemDto[];
}