import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/database/prisma.service';
import { PaymentService } from './payment.service';
import { TransferService } from '../Transfer/transfer.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class EscrowExpiryService {
  private readonly logger = new Logger(EscrowExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly transferService: TransferService,
  ) { }

  /**
   * Chạy mỗi phút để tìm các đơn hàng đã CONFIRMED quá 3 phút (SLA test)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredEscrows() {
    this.logger.log('Bắt đầu kiểm tra các Escrow quá hạn (3 phút SLA)...');

    const timeoutLimit = new Date();
    timeoutLimit.setMinutes(timeoutLimit.getMinutes() - 3);

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.CONFIRMED,
        confirmed_at: {
          lt: timeoutLimit,
        },
      },
      include: {
        listing: {
          include: {
            vehicle: true,
            seller: true,
          },
        },
        buyer: true,
        orderDetails: true,
      },
    });

    if (expiredOrders.length === 0) {
      this.logger.log('Không có đơn hàng nào bị quá hạn thanh toán 3 phút.');
      return;
    }

    this.logger.log(`Tìm thấy ${expiredOrders.length} đơn hàng quá hạn. Đang xử lý FORFEIT...`);

    for (const order of expiredOrders) {
      try {
        await this.handleExpiredOrder(order);
      } catch (error) {
        this.logger.error(
          `Lỗi khi xử lý Forfeit cho Order ${order.order_id}: ${error.message}`,
          error.stack,
        );
      }
    }

    this.logger.log('Đã hoàn thành kiểm tra Escrow quá hạn.');
  }

  private async handleExpiredOrder(order: any) {
    this.logger.log(`Đang xử lý Forfeit cho Order [${order.order_id}]...`);

    // 1. Cập nhật trạng thái Order thành FORFEITED
    await this.prisma.order.update({
      where: { order_id: order.order_id },
      data: {
        status: OrderStatus.FORFEITED,
      },
    });

    // 2. Chuyển Listing về lại ACTIVE
    await this.prisma.listing.update({
      where: { listing_id: order.listing_id },
      data: {
        status: 'ACTIVE',
      },
    });

    // 3. Scenario 2: SLA Timeout -> Compensate Seller with deposit (DRAFTING)
    try {
      await this.transferService.createForfeitCompensation(order);
      this.logger.log(`[Escrow] Created DRAFTING compensation transfer for Order ${order.order_id} (Forfeited)`);
    } catch (err) {
      this.logger.error(`[Escrow] Failed to create compensation transfer for Order ${order.order_id}`, err.stack);
    }

    // 4. Gửi Notification cho Buyer (Bị mất cọc)
    await this.prisma.notification.create({
      data: {
        user_id: order.buyer_id,
        type: 'ORDER',
        title: 'Order Forfeited',
        message: `Your confirmed order for ${order.listing.vehicle.brand} ${order.listing.vehicle.model} has been forfeited due to 3m inactivity. Deposit is non-refundable.`,
        created_at: new Date(),
      },
    });

    // 5. Gửi Notification cho Seller (Nhận được tiền cọc)
    await this.prisma.notification.create({
      data: {
        user_id: order.listing.seller_id,
        type: 'ORDER',
        title: 'Buyer Forfeited Deposit',
        message: `The buyer did not pay the remaining amount for ${order.listing.vehicle.brand} ${order.listing.vehicle.model} within 3m. Your listing is now ACTIVE and you received the deposit payout.`,
        created_at: new Date(),
      },
    });

    this.logger.log(`Forfeit Order [${order.order_id}] THÀNH CÔNG.`);
  }
}

