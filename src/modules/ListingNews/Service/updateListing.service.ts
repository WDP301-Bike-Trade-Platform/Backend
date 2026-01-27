import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { UpdateListingDto } from '../DTOs/update-listing.dto';
import { ListingStatus, MediaType } from '@prisma/client';

@Injectable()
export class UpdateListingService {
  constructor(private readonly prisma: PrismaService) {}

  async updateListing(
    listingId: string,
    sellerId: string,
    dto: UpdateListingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 0️⃣ Check ownership + status
      const listing = await tx.listing.findFirst({
        where: {
          listing_id: listingId,
          seller_id: sellerId,
        },
      });

      if (!listing) {
        throw new BadRequestException('Listing không tồn tại');
      }

      if (listing.status !== ListingStatus.PENDING_APPROVAL) {
        throw new BadRequestException(
          'Tin đã được duyệt hoặc bị từ chối, không thể chỉnh sửa',
        );
      }

      // 1️⃣ Build vehicle update data (chỉ field có gửi)
      const vehicleUpdateData: any = {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),

        ...(dto.bike_type !== undefined && { bike_type: dto.bike_type }),
        ...(dto.material !== undefined && { material: dto.material }),
        ...(dto.brake_type !== undefined && { brake_type: dto.brake_type }),
        ...(dto.wheel_size !== undefined && { wheel_size: dto.wheel_size }),

        ...(dto.groupset !== undefined && { groupset: dto.groupset }),
        ...(dto.frame_size !== undefined && { frame_size: dto.frame_size }),
        ...(dto.mileage_km !== undefined && { mileage_km: dto.mileage_km }),

        ...(dto.is_original !== undefined && { is_original: dto.is_original }),
        ...(dto.has_receipt !== undefined && { has_receipt: dto.has_receipt }),
      };

      if (Object.keys(vehicleUpdateData).length > 0) {
        await tx.vehicle.update({
          where: { vehicle_id: listing.vehicle_id },
          data: vehicleUpdateData,
        });
      }

      // 2️⃣ Update images (replace all)
      if (dto.images) {
        await tx.listingMedia.deleteMany({
          where: {
            listing_id: listingId,
            type: MediaType.IMAGE,
          },
        });

        await tx.listingMedia.createMany({
          data: dto.images.map((url) => ({
            listing_id: listingId,
            type: MediaType.IMAGE,
            file_url: url,
            mime_type: 'image/jpeg',
            size_bytes: BigInt(0), // mock
            uploaded_at: new Date(),
          })),
        });
      }

      // 3️⃣ Touch updated_at
      await tx.listing.update({
        where: { listing_id: listingId },
        data: {
          updated_at: new Date(),
        },
      });

      return {
        message: 'Cập nhật tin đăng thành công',
      };
    });
  }
}
