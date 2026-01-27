import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ListingStatus } from '@prisma/client';
import { BANNED_KEYWORDS } from 'src/common/types/banned_type';

@Injectable()
export class AdminListingService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================
  // APPROVE LISTING
  // ==========================
  async approveListing(
    listingId: string,
    adminId: string,
    note?: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: listingId },
      include: {
        vehicle: true, // 👈 lấy nội dung để check từ cấm
      },
    });

    if (!listing) {
      throw new BadRequestException('Listing không tồn tại');
    }

    if (listing.status !== ListingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Listing không ở trạng thái chờ duyệt');
    }

    // 🔥 1. Check banned keywords
    const violatedKeyword = this.detectBannedKeyword(listing);

    if (violatedKeyword) {
      await this.autoReject(
        listingId,
        adminId,
        `Chứa từ cấm: "${violatedKeyword}"`,
      );

      throw new BadRequestException(
        `Tin bị từ chối do chứa từ cấm: "${violatedKeyword}"`,
      );
    }

    // 🔥 2. Set expires_at = now + 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.listing.update({
      where: { listing_id: listingId },
      data: {
        status: ListingStatus.APPROVED,
        approved_by: adminId,
        approved_at: new Date(),
        expires_at: expiresAt,
        approval_note: note,
        updated_at: new Date(),
      },
    });

    return {
      message: 'Duyệt tin thành công',
      expires_at: expiresAt,
    };
  }

  // ==========================
  // REJECT LISTING (MANUAL)
  // ==========================
  async rejectListing(
    listingId: string,
    adminId: string,
    note: string,
  ) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: listingId },
    });

    if (!listing) {
      throw new BadRequestException('Listing không tồn tại');
    }

    if (listing.status !== ListingStatus.PENDING_APPROVAL) {
      throw new BadRequestException('Listing không ở trạng thái chờ duyệt');
    }

    await this.autoReject(listingId, adminId, note);

    return { message: 'Từ chối tin đăng thành công' };
  }

  // ==========================
  // PRIVATE HELPERS
  // ==========================

  private detectBannedKeyword(listing: any): string | null {
    const content = `
      ${listing.vehicle?.description ?? ''}
      ${listing.vehicle?.frame_serial ?? ''}
      ${listing.approval_note ?? ''}
    `.toLowerCase();

    return (
      BANNED_KEYWORDS.find((keyword) =>
        content.includes(keyword.toLowerCase()),
      ) ?? null
    );
  }

  private async autoReject(
    listingId: string,
    adminId: string,
    note: string,
  ) {
    await this.prisma.listing.update({
      where: { listing_id: listingId },
      data: {
        status: ListingStatus.REJECTED,
        approved_by: adminId,
        approved_at: new Date(),
        approval_note: note,
        updated_at: new Date(),
      },
    });
  }
}
