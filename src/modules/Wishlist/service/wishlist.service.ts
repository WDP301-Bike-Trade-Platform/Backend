import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  // Lấy wishlist của user (kèm thông tin sản phẩm)
  async getWishlist(userId: string) {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { user_id: userId },
      include: {
        items: {
          orderBy: { added_at: 'desc' },
          include: {
            listing: {
              include: {
                vehicle: true,
                media: {
                  where: { is_cover: true },
                  take: 1,
                },
                seller: {
                  select: {
                    user_id: true,
                    full_name: true,
                    profile: { select: { avatar_url: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Nếu chưa có wishlist, trả về object rỗng
    if (!wishlist) {
      return {
        wishlist_id: null,
        user_id: userId,
        items: [],
      };
    }

    // Map dữ liệu cho phù hợp với DTO
    return {
      wishlist_id: wishlist.wishlist_id,
      user_id: wishlist.user_id,
      items: wishlist.items.map((item) => ({
        wishlist_item_id: item.wishlist_item_id,
        listing_id: item.listing_id,
        added_at: item.added_at,
        vehicle: {
          brand: item.listing.vehicle.brand,
          model: item.listing.vehicle.model,
          year: item.listing.vehicle.year,
          price: item.listing.vehicle.price,
          condition: item.listing.vehicle.condition,
        },
        media: item.listing.media.map((m) => ({
          file_url: m.file_url,
          is_cover: m.is_cover,
        })),
        seller: {
          user_id: item.listing.seller.user_id,
          full_name: item.listing.seller.full_name,
          avatar_url: item.listing.seller.profile?.avatar_url,
        },
      })),
    };
  }

  // Thêm một sản phẩm vào wishlist
  async addToWishlist(userId: string, listingId: string) {
    // Kiểm tra listing tồn tại
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    // Tìm hoặc tạo wishlist cho user
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { user_id: userId },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { user_id: userId },
      });
    }

    // Thêm item
    try {
      const item = await this.prisma.wishlistItem.create({
        data: {
          wishlist_id: wishlist.wishlist_id,
          listing_id: listingId,
        },
        include: {
          listing: {
            include: {
              vehicle: true,
              media: { where: { is_cover: true }, take: 1 },
              seller: {
                select: {
                  user_id: true,
                  full_name: true,
                  profile: { select: { avatar_url: true } },
                },
              },
            },
          },
        },
      });

      // Trả về item đã được format
      return {
        wishlist_item_id: item.wishlist_item_id,
        listing_id: item.listing_id,
        added_at: item.added_at,
        vehicle: {
          brand: item.listing.vehicle.brand,
          model: item.listing.vehicle.model,
          year: item.listing.vehicle.year,
          price: item.listing.vehicle.price,
          condition: item.listing.vehicle.condition,
        },
        media: item.listing.media.map((m) => ({ file_url: m.file_url, is_cover: m.is_cover })),
        seller: {
          user_id: item.listing.seller.user_id,
          full_name: item.listing.seller.full_name,
          avatar_url: item.listing.seller.profile?.avatar_url,
        },
      };
    } catch (error) {
      // Mã lỗi Prisma P2002: unique constraint violation (đã tồn tại)
      if (error.code === 'P2002') {
        throw new ConflictException('Item already in wishlist');
      }
      throw error;
    }
  }

  // ==================== THÊM MỚI: Thêm nhiều sản phẩm ====================
  async addMultipleToWishlist(userId: string, listingIds: string[]) {
    // Tìm hoặc tạo wishlist
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { user_id: userId },
    });
    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { user_id: userId },
      });
    }

    // Lọc các listing đã có trong wishlist
    const existingItems = await this.prisma.wishlistItem.findMany({
      where: {
        wishlist_id: wishlist.wishlist_id,
        listing_id: { in: listingIds },
      },
      select: { listing_id: true },
    });
    const existingIds = new Set(existingItems.map(i => i.listing_id));
    const newListingIds = listingIds.filter(id => !existingIds.has(id));

    if (newListingIds.length === 0) {
      return { added: [], skipped: listingIds.length };
    }

    // Kiểm tra các listing có tồn tại không
    const listings = await this.prisma.listing.findMany({
      where: { listing_id: { in: newListingIds } },
      select: { listing_id: true },
    });
    const validListingIds = listings.map(l => l.listing_id);
    const invalidIds = newListingIds.filter(id => !validListingIds.includes(id));
    if (invalidIds.length > 0) {
      // Có thể log warning, nhưng không throw lỗi, chỉ skip
    }

    if (validListingIds.length === 0) {
      return { added: [], skipped: listingIds.length };
    }

    // Thêm hàng loạt
    const data = validListingIds.map(listing_id => ({
      wishlist_id: wishlist.wishlist_id,
      listing_id,
    }));

    await this.prisma.wishlistItem.createMany({
      data,
      skipDuplicates: true, // an toàn kể cả khi có duplicate
    });

    // Lấy lại items vừa thêm kèm thông tin chi tiết
    const addedItems = await this.prisma.wishlistItem.findMany({
      where: {
        wishlist_id: wishlist.wishlist_id,
        listing_id: { in: validListingIds },
      },
      include: {
        listing: {
          include: {
            vehicle: true,
            media: { where: { is_cover: true }, take: 1 },
            seller: {
              select: {
                user_id: true,
                full_name: true,
                profile: { select: { avatar_url: true } },
              },
            },
          },
        },
      },
    });

    return {
      added: addedItems.map(item => ({
        wishlist_item_id: item.wishlist_item_id,
        listing_id: item.listing_id,
        added_at: item.added_at,
        vehicle: {
          brand: item.listing.vehicle.brand,
          model: item.listing.vehicle.model,
          year: item.listing.vehicle.year,
          price: item.listing.vehicle.price,
          condition: item.listing.vehicle.condition,
        },
        media: item.listing.media.map(m => ({ file_url: m.file_url, is_cover: m.is_cover })),
        seller: {
          user_id: item.listing.seller.user_id,
          full_name: item.listing.seller.full_name,
          avatar_url: item.listing.seller.profile?.avatar_url,
        },
      })),
      skipped: listingIds.length - addedItems.length,
    };
  }

  // Xóa một sản phẩm khỏi wishlist
  async removeFromWishlist(userId: string, listingId: string) {
    // Tìm wishlist của user
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { user_id: userId },
    });
    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    // Tìm item cần xóa
    const item = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlist_id_listing_id: {
          wishlist_id: wishlist.wishlist_id,
          listing_id: listingId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Item not found in wishlist');
    }

    // Xóa item
    await this.prisma.wishlistItem.delete({
      where: {
        wishlist_id_listing_id: {
          wishlist_id: wishlist.wishlist_id,
          listing_id: listingId,
        },
      },
    });

    return { message: 'Removed from wishlist successfully' };
  }

  // ==================== THÊM MỚI: Xóa nhiều sản phẩm ====================
// Xóa nhiều sản phẩm khỏi wishlist (KHÔNG kiểm tra tồn tại từng item)
async removeMultipleFromWishlist(userId: string, listingIds: string[]) {
  const wishlist = await this.prisma.wishlist.findUnique({
    where: { user_id: userId },
  });
  
  if (!wishlist) {
    throw new NotFoundException('Wishlist not found');
  }

  // Xóa trực tiếp, nếu không có item nào thì result.count = 0
  const result = await this.prisma.wishlistItem.deleteMany({
    where: {
      wishlist_id: wishlist.wishlist_id,
      listing_id: { in: listingIds },
    },
  });

  // Nếu không xóa được item nào, vẫn trả về thành công (hoặc có thể báo warning)
  return { 
    deletedCount: result.count,
    message: result.count > 0 
      ? `Removed ${result.count} items successfully` 
      : 'No items were removed (they might not exist in wishlist)'
  };
}
}