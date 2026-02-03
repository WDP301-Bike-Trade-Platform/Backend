import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PayOS } from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma.service';
import { OrderService } from '../Order/order.service';


@Injectable()
export class PaymentService {
  private payos: PayOS;
  private readonly FRONTEND_URL: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) {
    // Sử dụng deep link cho mobile app
    // Development (Expo Go): exp://192.168.x.x:19000/--/
    // Production: myapp:// (custom scheme)
    this.FRONTEND_URL = this.configService.get<string>('FRONTEND_URL') || 'myapp://';
    this.payos = new PayOS({
      clientId: this.configService.get<string>('PAYOS_CLIENT_ID') || '',
      apiKey: this.configService.get<string>('PAYOS_API_KEY') || '',
      checksumKey: this.configService.get<string>('PAYOS_CHECKSUM_KEY') || '',
    });
  }

  /**
   * Tạo payment link cho listing (tự động tạo order trước)
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

      if (listing.seller_id === buyerId) {
        throw new BadRequestException('Cannot buy your own listing');
      }

      // Tạo order trước để user có thể tracking
      const order = await this.prisma.order.create({
        data: {
          buyer_id: buyerId,
          listing_id: listingId,
          deposit_amount: listing.vehicle.price,
          status: 'PENDING',
          created_at: new Date(),
        },
      });

      // Tạo order detail
      await this.prisma.orderDetail.create({
        data: {
          order_id: order.order_id,
          listing_id: listingId,
          vehicle_id: listing.vehicle_id,
          quantity: 1,
          unit_price: listing.vehicle.price,
          total_price: listing.vehicle.price,
          created_at: new Date(),
        },
      });

      // Generate unique order code từ timestamp
      const orderCode = Number(Date.now().toString().slice(-9));

      // Lưu mapping orderCode -> orderId vào Payment table tạm thời
      await this.prisma.payment.create({
        data: {
          order_id: order.order_id,
          method: 'PAYOS',
          amount: listing.vehicle.price,
          status: 'PENDING',
          created_at: new Date(),
        },
      });

      // Tạo payment link với PayOS
      const paymentLinkData = {
        orderCode: orderCode,
        amount: Number(listing.vehicle.price),
        description: `${order.order_id.substring(0, 8)}`,
        returnUrl: `${this.FRONTEND_URL}payment/success?orderId=${order.order_id}&orderCode=${orderCode}`,
        cancelUrl: `${this.FRONTEND_URL}payment/cancel?orderId=${order.order_id}`,
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
          orderId: order.order_id,
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
   * Tạo payment link cho order (hỗ trợ nhiều items)
   */
  async createPaymentLinkForOrder(orderId: string, buyerId: string) {
    try {
      // Lấy thông tin order với các order details
      const order = await this.prisma.order.findUnique({
        where: { order_id: orderId },
        include: {
          orderDetails: {
            include: {
              vehicle: true,
              listing: true,
            },
          },
          listing: {
            include: {
              vehicle: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // Kiểm tra quyền sở hữu order
      if (order.buyer_id !== buyerId) {
        throw new BadRequestException('This order does not belong to you');
      }

      // Kiểm tra trạng thái order
      if (order.status !== 'PENDING') {
        throw new BadRequestException(
          'Payment link can only be created for pending orders',
        );
      }

      // Generate unique order code từ timestamp
      const orderCode = Number(Date.now().toString().slice(-9));

      // Chuẩn bị items cho PayOS
      const items = order.orderDetails.map((detail) => ({
        name: `${detail.vehicle.brand} ${detail.vehicle.model} (${detail.vehicle.year})`,
        quantity: detail.quantity,
        price: Number(detail.unit_price),
      }));

      // Tính tổng tiền
      const totalAmount = Number(order.deposit_amount);

      // Tạo payment record với status PENDING
      await this.prisma.payment.create({
        data: {
          order_id: order.order_id,
          method: 'PAYOS',
          amount: totalAmount,
          status: 'PENDING',
          created_at: new Date(),
        },
      });

      // Tạo payment link với PayOS
      const paymentLinkData = {
        orderCode: orderCode,
        amount: totalAmount,
        description: `${order.order_id.substring(0, 8)}`,
        returnUrl: `${this.FRONTEND_URL}payment/success?orderId=${orderId}&orderCode=${orderCode}`,
        cancelUrl: `${this.FRONTEND_URL}payment/cancel?orderId=${orderId}`,
        items: items,
      };

      const paymentLink = await this.payos.paymentRequests.create(
        paymentLinkData,
      );

      return {
        success: true,
        data: {
          orderCode: orderCode,
          orderId: order.order_id,
          paymentLinkId: paymentLink.paymentLinkId,
          paymentLink: paymentLink.checkoutUrl,
          qrCode: paymentLink.qrCode,
          amount: totalAmount,
          itemCount: order.orderDetails.length,
          items: order.orderDetails.map((detail) => ({
            vehicleBrand: detail.vehicle.brand,
            vehicleModel: detail.vehicle.model,
            quantity: detail.quantity,
            price: detail.unit_price,
          })),
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
   * Xác thực và xử lý webhook từ PayOS
   */
  async handleWebhook(webhookData: any) {
    try {
      // Xác thực webhook signature
      const verifiedData = await this.payos.webhooks.verify(webhookData);
     
      // Cho phép PayOS dashboard test webhook
      if (
        ["Ma giao dich thu nghiem", "VQRIO123"].includes(verifiedData.description)
      ) {
        return {
          success: true,
          message: "Ok",
          data: verifiedData,
        };
      }

      // code: "00" = thành công, khác = thất bại
      if (verifiedData.code !== "00") {
        return {
          success: false,
          message: 'Payment failed',
          data: verifiedData,
        };
      }

      // Parse orderId từ description (format: "abc12345")
      const orderIdPrefix = verifiedData.description;
      
      // Tìm order dựa vào orderId prefix từ description
      const order = await this.prisma.order.findFirst({
        where: {
          order_id: {
            startsWith: orderIdPrefix,
          },
          status: 'PENDING',
        },
        include: {
          buyer: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
            },
          },
          listing: {
            include: {
              vehicle: true,
              seller: {
                select: {
                  user_id: true,
                  full_name: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        return {
          success: false,
          message: 'Order not found',
          data: verifiedData,
        };
      }

      // Cập nhật order status thành DEPOSITED
      const updatedOrder = await this.prisma.order.update({
        where: { order_id: order.order_id },
        data: {
          status: 'DEPOSITED',
        },
      });

      // Tạo payment record
      await this.prisma.payment.create({
        data: {
          order_id: order.order_id,
          method: 'PAYOS',
          amount: verifiedData.amount,
          status: 'SUCCESS',
          created_at: new Date(),
        },
      });

      // Cập nhật listing status thành SOLD (nếu cần)
      await this.prisma.listing.update({
        where: { listing_id: order.listing_id },
        data: { status: 'SOLD' },
      });

      return {
        success: true,
        message: 'Payment processed successfully',
        data: {
          orderId: order.order_id,
          orderCode: verifiedData.orderCode,
          amount: verifiedData.amount,
          status: 'DEPOSITED',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }


}
