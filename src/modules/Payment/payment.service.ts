import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PayOS } from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma.service';
import { OrderService } from '../Order/order.service';
import { CreateOrderDto } from '../Order/dto/create-order.dto';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';


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
    // Deep link scheme cho mobile app
    // Development: biketrade:// (hoạt động với Expo Go và dev build)
    // Production: biketrade:// (custom scheme đã config trong app.json)
    this.FRONTEND_URL = this.configService.get<string>('FRONTEND_URL') || 'biketrade://';
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
      const orderPayload = {
        listingId,
        paymentMethod: 'PAYOS',
      } as CreateOrderDto;

      const orderResult = await this.orderService.createOrder(
        buyerId,
        orderPayload,
      );

      const order = orderResult.data;
      if (!order) {
        throw new BadRequestException('Cannot create order for listing');
      }

      const orderCode = Number(Date.now().toString().slice(-9));
      const amountToCharge = order.meta?.depositAmount ?? Number(order.deposit_amount);
      const vehicle = order.listing?.vehicle;
      const orderId = order.order_id;

      const paymentLinkData = {
        orderCode,
        amount: amountToCharge,
        description: `${orderId.substring(0, 8)}`,
        returnUrl: `${this.FRONTEND_URL}payment/success?orderId=${orderId}&orderCode=${orderCode}`,
        cancelUrl: `${this.FRONTEND_URL}payment/cancel?orderId=${orderId}`,
        items: order.orderDetails.map((detail) => ({
          name: `${detail.vehicle.brand} ${detail.vehicle.model} (${detail.vehicle.year})`,
          quantity: detail.quantity,
          price: Number(detail.unit_price),
        })),
      };

      const paymentLink = await this.payos.paymentRequests.create(
        paymentLinkData,
      );

      return {
        success: true,
        data: {
          orderId,
          orderCode,
          paymentLinkId: paymentLink.paymentLinkId,
          paymentLink: paymentLink.checkoutUrl,
          qrCode: paymentLink.qrCode,
          amount: amountToCharge,
          listingId: order.listing?.listing_id,
          vehicle: vehicle
            ? {
                brand: vehicle.brand,
                model: vehicle.model,
                year: vehicle.year,
                price: vehicle.price,
              }
            : null,
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

      await this.ensurePendingPaymentRecord(order.order_id, order.deposit_amount);

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

  private async ensurePendingPaymentRecord(
    orderId: string,
    amount: Prisma.Decimal,
  ) {
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        order_id: orderId,
        status: PaymentStatus.PENDING,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!pendingPayment) {
      await this.prisma.payment.create({
        data: {
          order_id: orderId,
          method: 'PAYOS',
          amount,
          status: PaymentStatus.PENDING,
          created_at: new Date(),
        },
      });
      return;
    }

    if (pendingPayment.amount.toString() !== amount.toString()) {
      await this.prisma.payment.update({
        where: { payment_id: pendingPayment.payment_id },
        data: { amount },
      });
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

      const updateResult = await this.orderService.updateOrderStatus(
        order.order_id,
        OrderStatus.CONFIRMED,
        {
          paymentMethod: 'PAYOS',
          paidAmount: verifiedData.amount,
          paymentCode: verifiedData.orderCode,
        },
      );

      return {
        success: true,
        message: 'Payment processed successfully',
        data: {
          orderId: order.order_id,
          orderCode: verifiedData.orderCode,
          amount: verifiedData.amount,
          status: updateResult.data?.status ?? OrderStatus.CONFIRMED,
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
