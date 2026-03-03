import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { ListingStatus, MediaType } from '@prisma/client';

@Injectable()
export class CreateListingService {
  constructor(private readonly prisma: PrismaService) {}

  async createListing(dto: CreateListingDto, sellerId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sanitizeOptional = (value?: string | null) => {
        if (value === undefined || value === null) {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      };

      // 🚫 0️⃣ CHECK: user có listing đang chờ duyệt không
      const pendingListing = await tx.listing.findFirst({
        where: {
          seller_id: sellerId,
          status: ListingStatus.PENDING_APPROVAL,
        },
        select: {
          listing_id: true,
        },
      });

      if (pendingListing) {
        throw new BadRequestException(
          'Bạn đang có tin đăng chờ duyệt. Vui lòng đợi admin duyệt trước khi đăng tin mới.',
        );
      }

      // 1️⃣ Category fallback = "Khác"
      let categoryId = sanitizeOptional(dto.category_id);

      if (!categoryId) {
        const otherCategory = await tx.category.findFirst({
          where: { name: 'Khác' },
        });

        if (!otherCategory) {
          throw new BadRequestException('Category "Khác" không tồn tại');
        }

        categoryId = otherCategory.category_id;
      }

      if (!categoryId) {
        throw new BadRequestException('Không xác định được category hợp lệ');
      }

      // 2️⃣ Tạo Vehicle
      const vehicle = await tx.vehicle.create({
        data: {
          category_id: categoryId,

          brand: dto.brand.trim(),
          model: dto.model.trim(),
          year: dto.year,
          price: dto.price,

          bike_type: dto.bike_type.trim(),
          material: dto.material.trim(),
          brake_type: dto.brake_type.trim(),
          wheel_size: sanitizeOptional(dto.wheel_size),

          condition: 'USED',
          usage_level: sanitizeOptional(dto.usage_level),
          mileage_km: dto.mileage_km,

          groupset: sanitizeOptional(dto.groupset),
          frame_size: sanitizeOptional(dto.frame_size),

          is_original: dto.is_original ?? true,
          has_receipt: dto.has_receipt ?? false,
          frame_serial: sanitizeOptional(dto.frame_serial),

          description: sanitizeOptional(dto.description),
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
          file_url: url.trim(),
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
