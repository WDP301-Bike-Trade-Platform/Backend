import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { ListingStatus, MediaType } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createListing(dto: CreateListingDto, sellerId: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1️⃣ Category fallback = "Khác"
      let categoryId = dto.category_id;

      if (!categoryId) {
        const otherCategory = await tx.category.findFirst({
        where: { name: 'Khác' },
        });

        if (!otherCategory) {
        throw new BadRequestException('Category "Khác" không tồn tại');
        }

        categoryId = otherCategory.category_id;
      }

      // 2️⃣ Tạo Vehicle
      const vehicle = await tx.vehicle.create({
        data: {
          category_id: categoryId,
          brand: dto.brand.trim(),
          model: dto.model.trim(),
          price: dto.price,
          condition: 'USED',
          year: new Date().getFullYear(),
          description: dto.description,
          created_at: new Date(),
        },
      });

      // 3️⃣ Tạo Listing
      const listing = await tx.listing.create({
        data: {
          seller_id: sellerId,
          vehicle_id: vehicle.vehicle_id,
          status: ListingStatus.PENDING_APPROVAL,

          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 4️⃣ Tạo ListingMedia
      await tx.listingMedia.createMany({
        data: dto.images.map((url) => ({
          listing_id: listing.listing_id,
          type: MediaType.IMAGE,
          file_url: url,
          mime_type: 'image/jpeg',
          size_bytes: BigInt(0), // mock cho đồ án
          uploaded_at: new Date(),
        })),
      });

      return {
        message: 'Đăng tin bán thành công, chờ admin duyệt',
        listing_id: listing.listing_id,
      };
    });
  }
}
