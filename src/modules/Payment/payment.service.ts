import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Inject, forwardRef } from '@nestjs/common';
import { PayOS } from '@payos/node';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/database/prisma.service';
import { OrderService } from '../Order/order.service';
import { CreateOrderDto } from '../Order/dto/create-order.dto';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';


@Injectable()
export class PaymentService {
  private payos: PayOS;
  private readonly BACKEND_URL: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) {
    // URL backend dùng cho returnUrl/cancelUrl của PayOS
    // PayOS redirect browser tới HTTPS URL → server redirect sang deep link mobile
    this.BACKEND_URL = this.configService.get<string>('BACKEND_URL') || 'http://localhost:3443';
    this.payos = new PayOS({
      clientId: this.configService.get<string>('PAYOS_CLIENT_ID') || '',
      apiKey: this.configService.get<string>('PAYOS_API_KEY') || '',
      checksumKey: this.configService.get<string>('PAYOS_CHECKSUM_KEY') || '',
    });
  }

  /**
   * Tạo payment link cho order (Hỗ trợ DEPOSIT, REMAINING, hoặc FULL)
   */
  async createPaymentLinkForOrder(orderId: string, buyerId: string, paymentStage: 'DEPOSIT' | 'REMAINING' | 'FULL' = 'FULL', platform: 'WEB' | 'MOBILE' = 'MOBILE') {
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

      // Generate unique order code từ timestamp
      const orderCode = Number(Date.now().toString().slice(-9));
      const totalPrice = order.orderDetails.reduce((acc, curr) => acc + Number(curr.total_price), 0);

      let amountToCharge = 0;
      let stagePrefix = '';

      if (paymentStage === 'FULL') {
        if (order.status !== 'PENDING') {
          throw new BadRequestException('FULL payment can only be created for PENDING orders');
        }
        amountToCharge = totalPrice;
        stagePrefix = 'FUL';
      } else if (paymentStage === 'DEPOSIT') {
        if (order.status !== 'PENDING') {
          throw new BadRequestException('Payment link for DEPOSIT can only be created for PENDING orders');
        }
        amountToCharge = Number(order.deposit_amount);
        stagePrefix = 'DEP';
      } else if (paymentStage === 'REMAINING') {
        if (order.status !== 'CONFIRMED') {
          throw new BadRequestException('Remaining payment can only be made for CONFIRMED orders');
        }

        if (!order.confirmed_at) {
          throw new BadRequestException('Order confirmation time is missing');
        }

        const now = new Date().getTime();
        const confTime = order.confirmed_at.getTime();
        const diffMinutes = (now - confTime) / (1000 * 60);

        if (diffMinutes > 3) {
          throw new BadRequestException('The 3-minute window for the remaining payment has expired.');
        }

        amountToCharge = totalPrice - Number(order.deposit_amount);
        stagePrefix = 'REM';

        if (amountToCharge <= 0) {
          throw new BadRequestException('Remaining amount is 0 or negative. No further payment required.');
        }
      }

      // Chuẩn bị items cho PayOS
      const items = order.orderDetails.map((detail) => ({
        name: `${detail.vehicle.brand} ${detail.vehicle.model} (${detail.vehicle.year})`,
        quantity: detail.quantity,
        price: Number(detail.unit_price),
      }));

      await this.ensurePendingPaymentRecord(order.order_id, new Prisma.Decimal(amountToCharge), paymentStage, orderCode);

      // description cannot exceed 25 characters on PayOS, we put Stage Prefix at the start
      // Strict 8-character shortOrderId avoiding dashes
      const shortOrderId = order.order_id.replace(/-/g, '').substring(0, 8);

      const returnUrl = this.buildRedirectUrl(platform, 'success', { orderId, orderCode: orderCode.toString() });
      const cancelUrl = this.buildRedirectUrl(platform, 'cancel', { orderId });

      // Tạo payment link với PayOS
      const paymentLinkData = {
        orderCode: orderCode,
        amount: amountToCharge,
        description: `${stagePrefix}${shortOrderId}`,
        returnUrl,
        cancelUrl,
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
          amount: amountToCharge,
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
    stage: 'DEPOSIT' | 'REMAINING' | 'FULL',
    orderCode: number
  ) {
    const pendingPayment = await this.prisma.payment.findFirst({
      where: {
        order_id: orderId,
        status: PaymentStatus.PENDING,
      },
      orderBy: { created_at: 'desc' },
    });

    if (!pendingPayment) {
      const paymentInfo = await this.prisma.payment.create({
        data: {
          order_id: orderId,
          order_code: BigInt(orderCode),
          method: 'PAYOS',
          amount: amount,
          status: PaymentStatus.PENDING,
          created_at: new Date(),
        },
      });

      // Track deposit record if this is the deposit or full stage
      if (stage === 'DEPOSIT' || stage === 'FULL') {
        const order = await this.prisma.order.findUnique({ where: { order_id: orderId } });
        if (order) {
          // If FULL, deposit amount is recorded as the original deposit_amount, 
          // or we just record the full amount to the payment_deposit table based on logic. 
          // Keeping original behavior: log the amount requested for this payment link.
          await this.prisma.paymentDeposit.create({
            data: {
              order_id: orderId,
              payment_id: paymentInfo.payment_id,
              buyer_id: order.buyer_id,
              amount: amount,
              status: 'PENDING',
              created_at: new Date(),
            }
          });
        }
      }
      return;
    }

    if (pendingPayment.amount.toString() !== amount.toString() || pendingPayment.order_code?.toString() !== orderCode.toString()) {
      await this.prisma.payment.update({
        where: { payment_id: pendingPayment.payment_id },
        data: { amount, order_code: BigInt(orderCode) },
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

      // Lấy orderCode từ webhook (PayOS luôn trả đúng orderCode ta đã gửi)
      const payosOrderCode = Number(verifiedData.orderCode);

      if (!payosOrderCode) {
        return {
          success: false,
          message: 'Missing orderCode',
          data: verifiedData,
        };
      }

      // Description is format "DEP<shortOrderId>", "REM<shortOrderId>", or "FUL<shortOrderId>"
      const rawDesc: string = verifiedData.description || '';
      const isDeposit = rawDesc.startsWith('DEP');
      const isRemaining = rawDesc.startsWith('REM');
      const isFull = rawDesc.startsWith('FUL');

      // Tìm Payment mapping chuẩn nhất dựa trên order_code thay vì cắt chuỗi description
      const paymentMapping = await this.prisma.payment.findUnique({
        where: {
          order_code: BigInt(payosOrderCode),
        },
        include: {
          order: {
            include: {
              buyer: {
                select: {
                  user_id: true,
                  full_name: true,
                  email: true,
                },
              },
              orderDetails: true,
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
            }
          }
        }
      });

      if (!paymentMapping || !paymentMapping.order) {
        return {
          success: false,
          message: 'Order not found',
          data: verifiedData,
        };
      }

      const order = paymentMapping.order;

      const totalPrice = order.orderDetails.reduce((acc, curr) => acc + Number(curr.total_price), 0);
      let nextStatus = order.status;

      // Logic: Validate paid amount >= required amount for security
      const amountPaid = verifiedData.amount;

      if (isFull || amountPaid >= totalPrice) {
        // FULL payment from PENDING -> PAID
        if (order.status === 'PENDING') {
          const updateResult = await this.orderService.updateOrderStatus(
            order.order_id,
            OrderStatus.PAID,
            {
              paymentMethod: 'PAYOS',
              paidAmount: amountPaid,
              paymentCode: verifiedData.orderCode,
            },
          );
          nextStatus = updateResult.data?.status ?? OrderStatus.PAID;
        }
      } else if (isDeposit || (!isDeposit && !isRemaining && !isFull)) {
        // Explicit DEP prefix -> PENDING -> DEPOSITED phase
        if (order.status === 'PENDING') {
          const updateResult = await this.orderService.updateOrderStatus(
            order.order_id,
            OrderStatus.DEPOSITED,
            {
              paymentMethod: 'PAYOS',
              paidAmount: amountPaid,
              paymentCode: verifiedData.orderCode,
            },
          );
          nextStatus = updateResult.data?.status ?? OrderStatus.DEPOSITED;
        }
      } else if (isRemaining) {
        // REMAINING payment -> CONFIRMED -> PAID phase
        if (order.status === 'CONFIRMED') {
          await this.prisma.payment.updateMany({
            where: {
              order_id: order.order_id,
              status: PaymentStatus.PENDING,
            },
            data: {
              status: PaymentStatus.SUCCESS,
              method: 'PAYOS',
            }
          });

          // Cập nhật trạng thái Order thành PAID thông qua OrderService
          const updateResult = await this.orderService.updateOrderStatus(
            order.order_id,
            OrderStatus.PAID,
            {
              paymentMethod: 'PAYOS',
              paidAmount: amountPaid,
              paymentCode: verifiedData.orderCode,
            },
          );

          // Notify the seller that the rest was paid.
          await this.prisma.notification.createMany({
            data: [
              {
                user_id: order.listing.seller_id,
                type: 'ORDER',
                title: 'Remaining Amount Paid',
                message: `The buyer has successfully paid the remaining amount for ${order.listing.vehicle.brand} ${order.listing.vehicle.model}.`,
                created_at: new Date(),
              },
              {
                user_id: order.buyer.user_id,
                type: 'ORDER',
                title: 'Payment Successful',
                message: `You successfully paid the remaining balance for ${order.listing.vehicle.brand} ${order.listing.vehicle.model}. Please arrange pickup/delivery and confirm completion.`,
                created_at: new Date(),
              }
            ]
          });
          nextStatus = updateResult.data?.status ?? OrderStatus.PAID;
        }
      }

      return {
        success: true,
        message: 'Payment processed successfully',
        data: {
          orderId: order.order_id,
          orderCode: verifiedData.orderCode,
          amount: verifiedData.amount,
          status: nextStatus,
        },
      };
    } catch (error) {
      const msg = error.message as string;
      const isSignatureError = msg?.toLowerCase()?.includes('signature');
      return {
        success: false,
        message: isSignatureError ? 'Invalid webhook signature' : 'Webhook processing failed',
        error: msg,
      };
    }
  }


  private buildRedirectUrl(platform: 'WEB' | 'MOBILE', type: 'success' | 'cancel', queryParams: Record<string, string>): string {
    let baseUrl: string | undefined;

    if (platform === 'WEB') {
      baseUrl = this.configService.get<string>('WEB_URL_BASE');
      if (!baseUrl) {
        throw new InternalServerErrorException('WEB_URL_BASE is not configured');
      }
    } else {
      baseUrl = this.configService.get<string>('DEEP_LINK_SCHEME');
      if (!baseUrl) {
        throw new InternalServerErrorException('DEEP_LINK_SCHEME is not configured');
      }
    }

    // Ensure safe URL construction (handling trailing slashes)
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    let path = type === 'success' ? '/payment-success' : '/payment-cancel';

    // For web, the structure might be different based on frontend routes
    if (platform === 'WEB') {
      path = type === 'success' ? '/payment/success' : '/payment/cancel';
    } else {
      // Mobile deep link
      path = type === 'success' ? 'payment/success' : 'payment/cancel';
      // Add slash if mobile base doesn't end with one and path doesn't start with one (not typically needed for deep links if base is myapp:// but handled safely)
      if (!baseUrl.endsWith('/') && !baseUrl.includes('://')) {
        path = '/' + path;
      } else if (baseUrl.includes('://') && !baseUrl.endsWith('/') && !path.startsWith('/')) {
        // myapp:// + payment/success is fine, myapp:// + /payment/success -> myapp:///payment/success
      }
    }

    const url = new URL(platform === 'WEB' ? `${normalizedBaseUrl}${path}` : `${normalizedBaseUrl}${normalizedBaseUrl.endsWith('/') ? '' : '/'}${path}`);

    // Append query parameters dynamically
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    return url.toString();
  }

}
