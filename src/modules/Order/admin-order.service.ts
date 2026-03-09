import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { NotificationService } from '../Notification/notification.service';
import { AdminOrderListQueryDto } from './dto/admin-order-query.dto';
import { AdminUpdateOrderStatusDto } from './dto/admin-update-order-status.dto';
import { ESCROW_RULES } from './order.constants';

/* ── Includes dùng chung ────────────────────────────────── */

const ADMIN_ORDER_RELATIONS = {
  listing: {
    include: {
      vehicle: true,
      seller: {
        select: {
          user_id: true,
          full_name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  buyer: {
    select: {
      user_id: true,
      full_name: true,
      email: true,
      phone: true,
    },
  },
  orderDetails: {
    include: {
      vehicle: true,
      listing: { include: { vehicle: true } },
    },
  },
  orderAddresses: { include: { address: true } },
  payments: { include: { deposits: true } },
  paymentDeposits: true,
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ADMIN_ORDER_RELATIONS;
}>;

/* ── Allowed status values (from OrderStatus enum) ──────── */

const ALLOWED_STATUSES: ReadonlySet<string> = new Set(
  Object.values(OrderStatus),
);

/* ── Transition matrix ──────────────────────────────────── */

const STATUS_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  [OrderStatus.PENDING]: new Set([
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.DEPOSITED]: new Set([
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.CONFIRMED]: new Set([
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ]),
  [OrderStatus.COMPLETED]: new Set(),
  [OrderStatus.CANCELLED]: new Set(),
};

/* ── Service ─────────────────────────────────────────────── */

@Injectable()
export class AdminOrderService {
  private readonly depositThreshold = new Prisma.Decimal(
    ESCROW_RULES.DEPOSIT_THRESHOLD_AMOUNT,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /* ────────────── Danh sách đơn hàng ─────────────────── */

  async getOrders(query: AdminOrderListQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 20, 100);

    const where: Prisma.OrderWhereInput = {};

    if (query.status) {
      const upper = query.status.toUpperCase();
      if (!ALLOWED_STATUSES.has(upper)) {
        throw new BadRequestException(
          `Invalid status. Allowed: ${[...ALLOWED_STATUSES].join(', ')}`,
        );
      }
      where.status = upper as OrderStatus;
    }
    if (query.buyerId) {
      where.buyer_id = query.buyerId;
    }
    if (query.sellerId) {
      where.listing = { seller_id: query.sellerId };
    }
    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) where.created_at.gte = new Date(query.from);
      if (query.to) where.created_at.lte = new Date(query.to);
    }

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: ADMIN_ORDER_RELATIONS,
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        items: orders.map((o) => this.mapOrderListItem(o)),
      },
    };
  }

  /* ────────────── Chi tiết đơn hàng ─────────────────── */

  async getById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: ADMIN_ORDER_RELATIONS,
    });

    if (!order) {
      throw new NotFoundException('Order not found.');

    }
      return {
      success: true,
      data: this.mapOrderDetail(order),
    };
  }
  async updateStatus(adminUserId: string, orderId: string, dto: AdminUpdateOrderStatusDto) {
    const targetStatus = dto.status.toUpperCase();

    if (!ALLOWED_STATUSES.has(targetStatus)) {
      throw new BadRequestException(
        `Invalid status value. Allowed: ${[...ALLOWED_STATUSES].join(', ')}`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: ADMIN_ORDER_RELATIONS,
    });

    if (!order) {
      throw new NotFoundException('Order not found.');
    }

    if (order.status === targetStatus) {
      return { success: true, message: 'Order is already in the requested status.' };
    }

    if (!this.isTransitionAllowed(order.status, targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition: ${order.status} → ${targetStatus}.`,
      );
    }

    switch (targetStatus) {
      case OrderStatus.CANCELLED:
        return this.cancelOrderAdmin(order, dto.reason);
      case OrderStatus.CONFIRMED:
        return this.confirmOrderAdmin(order, dto.reason);
      case OrderStatus.COMPLETED:
        return this.completeOrderAdmin(order, dto.reason);
      default: {
        // Fallback: cập nhật trực tiếp
        await this.prisma.order.update({
          where: { order_id: orderId },
          data: { status: targetStatus as OrderStatus },
        });
        return { success: true, message: 'Order status updated.' };
      }
    }
  }

  /* ────────────── Cancel ────────────────────────────────── */

  private async cancelOrderAdmin(order: OrderWithRelations, reason?: string) {
    const depositPaid = this.isDepositPaid(order);

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { order_id: order.order_id },
        data: { status: OrderStatus.CANCELLED },
      });

      // Phục hồi listing
      await this.restoreListings(tx, order);

      // Xử lý deposit / payment
      if (depositPaid) {
        await tx.paymentDeposit.updateMany({
          where: { order_id: order.order_id },
          data: {
            status: 'REFUNDED',
            note: reason
              ? `Admin cancelled: ${reason}`
              : 'Admin cancelled order',
          },
        });

        await tx.payment.updateMany({
          where: { order_id: order.order_id },
          data: { status: PaymentStatus.FAILED },
        });
      } else {
        await tx.payment.updateMany({
          where: {
            order_id: order.order_id,
            status: PaymentStatus.PENDING,
          },
          data: { status: PaymentStatus.FAILED },
        });
      }
    });

    // Thông báo buyer + seller
    const text = `Order has been cancelled by Admin${reason ? '. Reason: ' + reason : ''}`;
    await this.notifyOrderParties(order, 'Order Cancelled', text);

    return { success: true, message: 'Order has been cancelled.' };
  }

  /* ────────────── Confirm ───────────────────────────────── */

  private async confirmOrderAdmin(order: OrderWithRelations, reason?: string) {
    const paymentMethod = this.resolvePrimaryPaymentMethod(order.payments);

    // Chỉ COD mới cần admin xác nhận thủ công
    if (paymentMethod !== 'COD') {
      throw new BadRequestException(
        'Non-COD orders are confirmed when payment has been verified.',
      );
    }

    await this.prisma.order.update({
      where: { order_id: order.order_id },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmed_at: new Date(),
      },
    });

    const text = `Order has been confirmed by Admin${reason ? '. Note: ' + reason : ''}`;
    await this.notifyAsync(
      order.buyer_id,
      'Order Confirmed',
      text,
    );

    return { success: true, message: 'Order has been confirmed.' };
  }

  /* ────────────── Complete ──────────────────────────────── */

  private async completeOrderAdmin(order: OrderWithRelations, reason?: string) {
    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException(
        'Only confirmed orders can be completed.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { order_id: order.order_id },
        data: { status: OrderStatus.COMPLETED },
      });

      await this.markListingsSold(tx, order);
    });

    const text = `Order has been completed by Admin${reason ? '. Note: ' + reason : ''}`;
    await this.notifyAsync(
      order.listing.seller_id,
      'Order Completed',
      text,
    );

    return { success: true, message: 'Order has been completed.' };
  }

  /* ────────────── Helpers ───────────────────────────────── */

  private isTransitionAllowed(current: string, next: string): boolean {
    const allowed = STATUS_TRANSITIONS[current];
    return !!allowed && allowed.has(next);
  }

  private isDepositPaid(order: OrderWithRelations): boolean {
    const depositPaid = order.paymentDeposits.some((d) => {
      const s = (d.status ?? '').toUpperCase();
      return s === 'SUCCESS' || s === 'PAID';
    });
    if (depositPaid) return true;
    return order.payments.some(
      (p) => p.status === PaymentStatus.SUCCESS,
    );
  }

  private resolvePrimaryPaymentMethod(
    payments: OrderWithRelations['payments'],
  ): string | null {
    return payments[0]?.method?.toUpperCase() ?? null;
  }

  private async restoreListings(
    tx: Prisma.TransactionClient,
    order: OrderWithRelations,
  ) {
    const listingIds = this.collectListingIds(order);
    if (listingIds.length === 0) return;

    await tx.listing.updateMany({
      where: {
        listing_id: { in: listingIds },
        status: 'SOLD',
      },
      data: { status: 'APPROVED' },
    });
  }

  private async markListingsSold(
    tx: Prisma.TransactionClient,
    order: OrderWithRelations,
  ) {
    const listingIds = this.collectListingIds(order);
    if (listingIds.length === 0) return;

    await tx.listing.updateMany({
      where: { listing_id: { in: listingIds } },
      data: { status: 'SOLD' },
    });
  }

  private collectListingIds(order: OrderWithRelations): string[] {
    const ids = new Set<string>();
    ids.add(order.listing_id);
    for (const detail of order.orderDetails) {
      ids.add(detail.listing_id);
    }
    return [...ids];
  }

  private toNumber(value?: Prisma.Decimal | null): number {
    if (!value) return 0;
    return Number(value.toString());
  }

  /* ────────────── Mapping ───────────────────────────────── */

  private mapOrderListItem(order: OrderWithRelations) {
    const totalAmount = this.sumOrderDetails(order);
    const depositRequired = totalAmount.greaterThanOrEqualTo(
      this.depositThreshold,
    );
    const depositPaid = this.isDepositPaid(order);
    const address = order.orderAddresses[0]?.address_snapshot ?? null;

    return {
      orderId: order.order_id,
      listingId: order.listing_id,
      buyerId: order.buyer_id,
      sellerId: order.listing.seller_id,
      totalAmount: this.toNumber(totalAmount),
      paymentMethod: this.resolvePrimaryPaymentMethod(order.payments),
      status: order.status,
      createdAt: order.created_at,
      listingTitle: `${order.listing.vehicle.brand} ${order.listing.vehicle.model}`,
      listingPrice: this.toNumber(order.listing.vehicle.price),
      deliveryAddress: address,
      depositRequired,
      depositPaid,
    };
  }

  private mapOrderDetail(order: OrderWithRelations) {
    const totalAmount = this.sumOrderDetails(order);
    const depositRequired = totalAmount.greaterThanOrEqualTo(
      this.depositThreshold,
    );
    const depositPaid = this.isDepositPaid(order);
    const address = order.orderAddresses[0]?.address_snapshot ?? null;

    return {
      orderId: order.order_id,
      listingId: order.listing_id,
      buyerId: order.buyer_id,
      sellerId: order.listing.seller_id,
      totalAmount: this.toNumber(totalAmount),
      depositAmount: this.toNumber(order.deposit_amount),
      paymentMethod: this.resolvePrimaryPaymentMethod(order.payments),
      status: order.status,
      confirmedAt: order.confirmed_at,
      createdAt: order.created_at,
      listing: {
        title: `${order.listing.vehicle.brand} ${order.listing.vehicle.model}`,
        price: this.toNumber(order.listing.vehicle.price),
      },
      buyer: order.buyer,
      seller: order.listing.seller,
      deliveryAddress: address,
      orderDetails: order.orderDetails.map((d) => ({
        orderDetailId: d.order_detail_id,
        listingId: d.listing_id,
        vehicleId: d.vehicle_id,
        quantity: d.quantity,
        unitPrice: this.toNumber(d.unit_price),
        totalPrice: this.toNumber(d.total_price),
        vehicle: d.vehicle,
      })),
      payments: order.payments.map((p) => ({
        paymentId: p.payment_id,
        method: p.method,
        amount: this.toNumber(p.amount),
        platformFee: this.toNumber(p.platform_fee),
        status: p.status,
        createdAt: p.created_at,
      })),
      depositRequired,
      depositPaid,
    };
  }

  private sumOrderDetails(order: OrderWithRelations): Prisma.Decimal {
    return order.orderDetails.reduce(
      (sum, d) => sum.add(d.total_price),
      new Prisma.Decimal(0),
    );
  }

  /* ────────────── Notification helpers ──────────────────── */

  private async notifyOrderParties(
    order: OrderWithRelations,
    title: string,
    message: string,
  ) {
    await this.notifyAsync(order.buyer_id, title, message);
    await this.notifyAsync(order.listing.seller_id, title, message);
  }

  private async notifyAsync(
    userId: string,
    title: string,
    message: string,
  ) {
    try {
      await this.notificationService.createNotification({
        userId,
        title,
        message,
        type: 'ORDER' as any,
        link: undefined,
      });
    } catch {
      // Bỏ qua lỗi notification
    }
  }
}
