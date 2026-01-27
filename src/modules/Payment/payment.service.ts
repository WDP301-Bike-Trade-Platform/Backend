import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PayOS } from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class PaymentService {
  private payos: PayOS;
  private readonly FRONTEND_URL: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.FRONTEND_URL = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.payos = new PayOS({
      clientId: this.configService.get<string>('PAYOS_CLIENT_ID') || '',
      apiKey: this.configService.get<string>('PAYOS_API_KEY') || '',
      checksumKey: this.configService.get<string>('PAYOS_CHECKSUM_KEY') || '',
    });
  }

  /**
   * Tạo payment link cho listing
   */
  async createPaymentLinkForListing(
    listingId: string,
    buyerId: string,
  ) {
    try {
      // Lấy thông tin listing và vehicle
      const listing = await this.prisma.listing.findUnique({
        where: { listing_id: listingId },
        include: {
          vehicle: true,
        },
      });

      if (!listing) {
        throw new NotFoundException('Listing not found');
      }

      if (listing.status !== 'APPROVED' && listing.status !== 'ACTIVE') {
        throw new BadRequestException('Listing is not available for purchase');
      }

      // Generate unique order code từ timestamp
      const orderCode = Number(Date.now().toString().slice(-9));

      // Tạo payment link với PayOS
      const paymentLinkData = {
        orderCode: orderCode,
        amount: Number(listing.vehicle.price),
        description: `Thanh toán ${listing.vehicle.brand} ${listing.vehicle.model}`,
        returnUrl: `${this.FRONTEND_URL}/payment/success?listingId=${listingId}&orderCode=${orderCode}`,
        cancelUrl: `${this.FRONTEND_URL}/payment/cancel?listingId=${listingId}`,
        items: [
          {
            name: `${listing.vehicle.brand} ${listing.vehicle.model} (${listing.vehicle.year})`,
            quantity: 1,
            price: Number(listing.vehicle.price),
          },
        ],
      };

      const paymentLink = await this.payos.paymentRequests.create(
        paymentLinkData,
      );

      return {
        success: true,
        data: {
          orderCode: orderCode,
          paymentLinkId: paymentLink.paymentLinkId,
          paymentLink: paymentLink.checkoutUrl,
          qrCode: paymentLink.qrCode,
          amount: listing.vehicle.price,
          listingId: listing.listing_id,
          vehicle: {
            brand: listing.vehicle.brand,
            model: listing.vehicle.model,
            year: listing.vehicle.year,
            price: listing.vehicle.price,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Lấy thông tin payment bằng order code
   */
  async getPaymentInfo(orderCode: number) {
    try {
      const paymentInfo = await this.payos.paymentRequests.get(orderCode);
      return {
        success: true,
        data: paymentInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Hủy payment link
   */
  async cancelPaymentLink(orderCode: number, cancellationReason?: string) {
    try {
      const result = await this.payos.paymentRequests.cancel(
        orderCode,
        cancellationReason,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Xác thực webhook từ PayOS
   */
  async verifyWebhook(webhookData: any) {
    try {
      // Xác thực webhook
      const verifiedData = await this.payos.webhooks.verify(webhookData);

      return {
        success: true,
        data: verifiedData,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
