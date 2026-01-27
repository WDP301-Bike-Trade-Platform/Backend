import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';
import { ListingStatus } from '@prisma/client';

@Injectable()
export class ListingExpirationCron {
  constructor(private readonly prisma: PrismaService) {}

  // ⏰ Chạy mỗi 5 phút
  @Cron('*/30 * * * * *') // mỗi 10 giây
  async handleExpireListings() {
    const now = new Date();
    console.log('[CRON]', {
      now: now.toISOString(),
    });
    const result = await this.prisma.listing.updateMany({
      where: {
        status: ListingStatus.APPROVED,
        expires_at: {
          lt: now, // đã hết hạn
        },
      },
      data: {
        status: ListingStatus.HIDDEN,
        updated_at: now,
      },
    });

    if (result.count > 0) {
      console.log(`[CRON] Hidden ${result.count} expired listings`);
    }
  }
}
