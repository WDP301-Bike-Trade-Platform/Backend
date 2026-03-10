import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { ListingStatus, MediaType } from '@prisma/client';

@Injectable()
export class CreateListingService {
  constructor(private readonly prisma: PrismaService) {}

  async createListing(dto: CreateListingDto, sellerId: string) {
    // Check profile completeness before allowing listing creation
    const seller = await this.prisma.user.findUnique({
      where: { user_id: sellerId },
      include: { profile: true },
    });

    if (!seller) {
      throw new BadRequestException('User not found');
    }

    if (!seller.full_name || !seller.phone) {
      throw new BadRequestException(
        'Please complete your profile (full name, phone) before creating a listing',
      );
    }

    const profile = seller.profile;
    if (
      !profile ||
      !profile.dob ||
      !profile.gender ||
      !profile.national_id ||
      !profile.avatar_url ||
      !profile.bank_account ||
      !profile.bank_name ||
      !profile.bank_bin
    ) {
      throw new BadRequestException(
        'Please complete your profile (date of birth, gender, national ID, avatar) before creating a listing',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const sanitizeOptional = (value?: string | null) => {
        if (value === undefined || value === null) {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
      };

      // Check: user has a listing pending approval
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
          'You already have a listing pending approval. Please wait for admin review before creating a new one.',
        );
      }

      // Category fallback = "Khác" (Other)
      let categoryId = sanitizeOptional(dto.category_id);

      if (!categoryId) {
        const otherCategory = await tx.category.findFirst({
          where: { name: 'Khác' },
        });

        if (!otherCategory) {
          throw new BadRequestException('Default category not found');
        }

        categoryId = otherCategory.category_id;
      }

      if (!categoryId) {
        throw new BadRequestException('Could not determine a valid category');
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
        message: 'Listing created successfully, pending admin approval',
        listing_id: listing.listing_id,
      };
    });
  }
}
