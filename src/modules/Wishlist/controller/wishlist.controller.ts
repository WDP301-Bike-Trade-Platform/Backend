import { Controller, Get, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { WishlistService } from '../service/wishlist.service';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { AddWishlistDto } from '../dtos/add-wishlist.dto';
import { WishlistResponseDto } from '../dtos/wishlist-response.dto';
import { BulkWishlistDto } from '../dtos/bulk-wishlist.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('wishlist')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wishlist')
@Roles(1) // Giả sử role 1 là USER
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách wishlist của user hiện tại' })
  @ApiResponse({ 
    status: 200, 
    type: WishlistResponseDto,
    example: {
      wishlist_id: '754c1b71-a1eb-4ef0-a3de-4847dd2ed2aa',
      user_id: '67c4441b-2112-4d91-82a9-ef86cd343d93',
      items: [
        {
          wishlist_item_id: 'bd91bf8e-b184-4468-9d6d-befaf0fe0384',
          listing_id: '27290d97-7fcd-4cd0-b28b-99d78cf32f9f',
          added_at: '2025-03-04T10:00:00.000Z',
          vehicle: {
            brand: 'Spec',
            model: 'A3',
            year: 2020,
            price: 10000,
            condition: 'USED',
          },
          media: [
            { file_url: 'https://example.com/image.jpg', is_cover: true }
          ],
          seller: {
            user_id: '72e38948-71af-4219-87e3-6436b771f7c4',
            full_name: 'Nguyen Van A',
            avatar_url: null
          }
        }
      ]
    }
  })
  async getWishlist(@CurrentUser('user_id') userId: string) {
    return this.wishlistService.getWishlist(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Thêm một sản phẩm vào wishlist' })
  @ApiResponse({ 
    status: 201, 
    description: 'Đã thêm thành công',
    example: {
      wishlist_item_id: 'bd91bf8e-b184-4468-9d6d-befaf0fe0384',
      listing_id: '27290d97-7fcd-4cd0-b28b-99d78cf32f9f',
      added_at: '2025-03-04T10:00:00.000Z',
      vehicle: { brand: 'Spec', model: 'A3', year: 2020, price: 10000, condition: 'USED' },
      media: [{ file_url: 'https://example.com/image.jpg', is_cover: true }],
      seller: { user_id: '72e38948-71af-4219-87e3-6436b771f7c4', full_name: 'Nguyen Van A', avatar_url: null }
    }
  })
  @ApiResponse({ status: 409, description: 'Sản phẩm đã có trong wishlist' })
  async addToWishlist(
    @CurrentUser('user_id') userId: string,
    @Body() dto: AddWishlistDto,
  ) {
    return this.wishlistService.addToWishlist(userId, dto.listingId);
  }

  // ==================== THÊM MỚI: Bulk add ====================
  @Post('bulk')
  @ApiOperation({ summary: 'Thêm nhiều sản phẩm vào wishlist' })
  @ApiBody({ type: BulkWishlistDto })
  @ApiResponse({ 
    status: 201,
    example: {
      added: [
        {
          wishlist_item_id: 'bd91bf8e-b184-4468-9d6d-befaf0fe0384',
          listing_id: '27290d97-7fcd-4cd0-b28b-99d78cf32f9f',
          added_at: '2025-03-04T10:00:00.000Z',
          vehicle: { brand: 'Spec', model: 'A3', year: 2020, price: 10000, condition: 'USED' },
          media: [{ file_url: 'https://example.com/image.jpg', is_cover: true }],
          seller: { user_id: '72e38948-71af-4219-87e3-6436b771f7c4', full_name: 'Nguyen Van A', avatar_url: null }
        }
      ],
      skipped: 0
    }
  })
  async addMultipleToWishlist(
    @CurrentUser('user_id') userId: string,
    @Body() dto: BulkWishlistDto,
  ) {
    return this.wishlistService.addMultipleToWishlist(userId, dto.listingIds);
  }

// ==================== BULK DELETE (đặt lên trước) ====================
@Delete('bulk')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Xóa nhiều sản phẩm khỏi wishlist' })
@ApiBody({ type: BulkWishlistDto })
@ApiResponse({ 
  status: 200,
  example: { deletedCount: 2 }
})
async removeMultipleFromWishlist(
  @CurrentUser('user_id') userId: string,
  @Body() dto: BulkWishlistDto,
) {
  return this.wishlistService.removeMultipleFromWishlist(userId, dto.listingIds);
}

// ==================== Xóa một (đặt sau) ====================
@Delete(':listingId')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Xóa một sản phẩm khỏi wishlist' })
@ApiResponse({ 
  status: 200, 
  description: 'Đã xóa thành công',
  example: { message: 'Removed from wishlist successfully' }
})
@ApiResponse({ status: 404, description: 'Không tìm thấy item' })
async removeFromWishlist(
  @CurrentUser('user_id') userId: string,
  @Param('listingId') listingId: string,
) {
  return this.wishlistService.removeFromWishlist(userId, listingId);
}
}