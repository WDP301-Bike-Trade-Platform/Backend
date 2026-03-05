import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class BulkWishlistDto {
  @ApiProperty({
    type: [String],
    example: ['27290d97-7fcd-4cd0-b28b-99d78cf32f9f', 'another-uuid-here'],
    description: 'Mảng các listingId cần thêm hoặc xóa khỏi wishlist'
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  listingIds: string[];
}