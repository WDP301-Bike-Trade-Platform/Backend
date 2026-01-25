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
          year: dto.year,
          price: dto.price,

          bike_type: dto.bike_type,
          material: dto.material,
          brake_type: dto.brake_type,
          wheel_size: dto.wheel_size,

          condition: 'USED',
          usage_level: dto.usage_level,
          mileage_km: dto.mileage_km,

          groupset: dto.groupset,
          frame_size: dto.frame_size,

          is_original: dto.is_original ?? true,
          has_receipt: dto.has_receipt ?? false,
          frame_serial: dto.frame_serial,

          description: dto.description,
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
