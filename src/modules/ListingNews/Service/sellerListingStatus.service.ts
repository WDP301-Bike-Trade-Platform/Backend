import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ListingStatus } from '@prisma/client';
import {
  ChangeListingStatusDto,
  SellerListingAction,
} from '../DTOs/seller-update-listing-status.dto';

@Injectable()
export class ChangeListingStatusService {
  constructor(private readonly prisma: PrismaService) {}

  private mapActionToStatus(action: SellerListingAction): ListingStatus {
    switch (action) {
      case SellerListingAction.SHOW:
        return ListingStatus.ACTIVE;
      case SellerListingAction.HIDE:
        return ListingStatus.HIDDEN;
      case SellerListingAction.MARK_SOLD:
        return ListingStatus.SOLD;
      default:
        throw new BadRequestException('Invalid action');
    }
  }

  async changeStatus(
    listingId: string,
    sellerId: string,
    dto: ChangeListingStatusDto,
  ) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        listing_id: listingId,
        seller_id: sellerId,
      },
    });

    if (!listing) {
      throw new BadRequestException('Listing not found');
    }

    if (
      listing.status !== ListingStatus.APPROVED &&
      listing.status !== ListingStatus.ACTIVE &&
      listing.status !== ListingStatus.HIDDEN
    ) {
      throw new BadRequestException('Listing is not approved or has expired');
    }

    const nextStatus = this.mapActionToStatus(dto.action);

    await this.prisma.listing.update({
      where: { listing_id: listingId },
      data: {
        status: nextStatus,
        updated_at: new Date(),
      },
    });

    return {
      message: 'Listing status updated successfully',
      status: nextStatus,
    };
  }
}
