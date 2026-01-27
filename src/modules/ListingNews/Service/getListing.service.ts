import { Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import { paginate } from 'src/common/utils/pagination';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class GetListingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /listings
   * Admin / Public
   */
  async getAll(query: {
    page?: number;
    limit?: number;
    status?: ListingStatus;
  }) {
    const where = {
      ...(query.status && { status: query.status }),
    };

    return paginate({
      page: query.page,
      limit: query.limit,
      countFn: () =>
        this.prisma.listing.count({
          where,
        }),
      dataFn: (skip, take) =>
        this.prisma.listing.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            vehicle: true,
            seller: {
              select: {
                user_id: true,
                full_name: true,
                email: true,
              },
            },
            media: true,
          },
        }),
    });
  }

  /**
   * GET /listings/me
   * Seller
   */
  async getByMe(
    sellerId: string,
    query: {
      page?: number;
      limit?: number;
      status?: ListingStatus;
    },
  ) {
    const where = {
      seller_id: sellerId,
      ...(query.status && { status: query.status }),
    };

    return paginate({
      page: query.page,
      limit: query.limit,
      countFn: () =>
        this.prisma.listing.count({
          where,
        }),
      dataFn: (skip, take) =>
        this.prisma.listing.findMany({
          where,
          skip,
          take,
          orderBy: { created_at: 'desc' },
          include: {
            vehicle: true,
            media: true,
          },
        }),
    });
  }

  /**
   * GET /listings/:id
   */
  async getById(id: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: id },
      include: {
        vehicle: true,
        seller: true,
        inspections: true,
        media: true,
        messages: true,
        reviews: true,
        reports: true,
      },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    return listing;
  }
}
