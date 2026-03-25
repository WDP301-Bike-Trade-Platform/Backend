import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateOfferDto } from '../DTOs/create-offer.dto';
import { Prisma, OfferStatus } from '@prisma/client';
import { NotificationService } from 'src/modules/Notification/notification.service';

@Injectable()
export class OfferService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) { }

  async getOfferById(offerId: string, userId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { offer_id: offerId },
      include: {
        listing: { include: { vehicle: true } }
      },
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    if (offer.buyer_id !== userId && offer.seller_id !== userId) {
      throw new ForbiddenException('You do not have permission to view this offer information');
    }

    return offer;
  }

  async createOffer(buyerId: string, dto: CreateOfferDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: dto.listingId },
    });

    if (!listing) throw new NotFoundException('Product not found');
    if (listing.status !== 'ACTIVE' && listing.status !== 'APPROVED') throw new BadRequestException('Product is no longer available for offers');
    if (listing.seller_id === buyerId) throw new ForbiddenException('You cannot make an offer on your own product');

    const existingOffer = await this.prisma.offer.findFirst({
      where: {
        listing_id: dto.listingId,
        buyer_id: buyerId,
        status: { notIn: [OfferStatus.REJECTED, OfferStatus.CANCELLED] },
      },
    });

    if (existingOffer) {
      throw new BadRequestException('You already have an active offer for this product');
    }

    const offer = await this.prisma.offer.create({
      data: {
        listing_id: dto.listingId,
        buyer_id: buyerId,
        seller_id: listing.seller_id,
        offered_price: new Prisma.Decimal(dto.offeredPrice),
        status: OfferStatus.PENDING,
      },
    });

    // Notify seller
    this.notificationService.createNotification({
      userId: listing.seller_id,
      type: 'OFFER',
      title: 'New offer on your product',
      message: `A buyer just made an offer of ${dto.offeredPrice.toLocaleString('vi-VN')} VND for your product`,
      link: `/chat`, // Navigate to Chat UI
    }).catch(e => console.error('Notification Error:', e));
    return offer;
  }

  async acceptOffer(offerId: string, sellerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { offer_id: offerId },
      include: { listing: { include: { vehicle: true } } },
    });

    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.seller_id !== sellerId) throw new ForbiddenException('This is not your product');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException(`This offer is currently in status ${offer.status}`);

    const updatedOffer = await this.prisma.$transaction(async (tx) => {
      const acc = await tx.offer.update({
        where: { offer_id: offerId },
        data: { status: OfferStatus.ACCEPTED },
      });

      await tx.offer.updateMany({
        where: {
          buyer_id: offer.buyer_id,
          listing_id: offer.listing_id,
          status: OfferStatus.PENDING,
          offer_id: { not: offerId },
        },
        data: { status: OfferStatus.REJECTED },
      });

      return acc;
    });

    this.notificationService.createNotification({
      userId: offer.buyer_id,
      type: 'OFFER',
      title: 'Offer accepted!',
      message: `The seller has accepted the offer of ${offer.offered_price.toNumber().toLocaleString('vi-VN')} VND for the ${offer.listing.vehicle.brand}. Please pay 100% to complete the order!`,
      link: `/chat`,
    }).catch(e => console.error('Notification Error:', e));

    return updatedOffer;
  }

  async rejectOffer(offerId: string, sellerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { offer_id: offerId },
    });

    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.seller_id !== sellerId) throw new ForbiddenException('This is not your product');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException(`This offer is currently in status ${offer.status}`);

    const updatedOffer = await this.prisma.offer.update({
      where: { offer_id: offerId },
      data: { status: OfferStatus.REJECTED },
    });

    return updatedOffer;
  }

  async cancelOffer(offerId: string, buyerId: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { offer_id: offerId },
    });

    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.buyer_id !== buyerId) throw new ForbiddenException('You are not the creator of this offer');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException(`This offer has already been processed or cancelled (${offer.status})`);

    const updatedOffer = await this.prisma.offer.update({
      where: { offer_id: offerId },
      data: { status: OfferStatus.CANCELLED },
    });

    return updatedOffer;
  }
}
