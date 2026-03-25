import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { ListingStatus, MediaType } from '@prisma/client';
import { EmbeddingService } from 'src/modules/AI/Service/embedding.service';

@Injectable()
export class CreateListingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) { }

  async createListing(dto: CreateListingDto, sellerId: string) {
    // Kiểm tra profile (giữ nguyên như cũ)
    const seller = await this.prisma.user.findUnique({
      where: { user_id: sellerId },
      include: { profile: true },
    });
    if (!seller) throw new BadRequestException('User not found');
    if (!seller.full_name || !seller.phone) {
      throw new BadRequestException(
        'Please complete your profile (full name, phone) before creating a listing',
      );
    }
    const profile = seller.profile;
    if (
      !profile ||
      !profile.national_id ||
      !profile.bank_account ||
      !profile.bank_bin
    ) {
      throw new BadRequestException(
        'Please complete your profile before creating a listing',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const sanitizeOptional = (value?: string | null) => {
        if (value === undefined || value === null) return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      };

      // Check pending listing
      const pendingListing = await tx.listing.findFirst({
        where: { seller_id: sellerId, status: ListingStatus.PENDING_APPROVAL },
        select: { listing_id: true },
      });
      if (pendingListing) {
        throw new BadRequestException(
          'You already have a listing pending approval. Please wait for admin review before creating a new one.',
        );
      }

      // Category fallback
      let categoryId = sanitizeOptional(dto.category_id);
      if (!categoryId) {
        const otherCategory = await tx.category.findFirst({
          where: { name: 'Khác' },
        });
        if (!otherCategory) throw new BadRequestException('Default category not found');
        categoryId = otherCategory.category_id;
      }

      // Tạo Vehicle
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

      // Tạo Listing
      const listing = await tx.listing.create({
        data: {
          seller_id: sellerId,
          vehicle_id: vehicle.vehicle_id,
          status: ListingStatus.PENDING_APPROVAL,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Tạo ListingMedia
      await tx.listingMedia.createMany({
        data: dto.images.map((url) => ({
          listing_id: listing.listing_id,
          type: MediaType.IMAGE,
          file_url: url.trim(),
          mime_type: 'image/jpeg',
          size_bytes: BigInt(0),
          uploaded_at: new Date(),
        })),
      });

      // Tạo embedding từ thông tin xe
      const description = `
        ${vehicle.brand} ${vehicle.model} ${vehicle.year}
        Giá: ${vehicle.price}
        Tình trạng: ${vehicle.condition}
        Loại xe: ${vehicle.bike_type}
        Khung: ${vehicle.material}
        Phanh: ${vehicle.brake_type}
        Nhóm linh kiện: ${vehicle.groupset || ''}
        Kích thước khung: ${vehicle.frame_size || ''}
        Số km đã đi: ${vehicle.mileage_km || ''}
        Mô tả: ${vehicle.description || ''}
      `.trim();

      try {
        const embedding = await this.embeddingService.generateEmbedding(description);
        if (embedding) {
          // Dùng raw SQL để cập nhật cột unsupported
          await tx.$executeRaw`
            UPDATE listings
            SET embedding = ${JSON.stringify(embedding)}::vector
            WHERE listing_id = ${listing.listing_id}
          `;
        }
      } catch (error) {
        console.error(`Failed to generate embedding for listing ${listing.listing_id}`, error);
        // Không throw lỗi để transaction vẫn commit
      }

      return {
        message: 'Listing created successfully, pending admin approval',
        listing_id: listing.listing_id,
      };
    });
  }
}