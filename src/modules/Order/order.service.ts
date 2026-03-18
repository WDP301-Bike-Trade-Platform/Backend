import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { Prisma, OrderStatus, PaymentStatus, Address } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import { CartService } from '../Cart/cart.service';
import { TransferService } from '../Transfer/transfer.service';
import { ESCROW_RULES, SupportedPaymentMethod } from './order.constants';
import { ShippingDemoService } from '../Shipping/Service/shipping.service';

const ORDER_RELATIONS = {
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
      listing: {
        include: {
          vehicle: true,
        },
      },
    },
  },
  orderAddresses: {
    include: {
      address: true,
    },
  },
  payments: {
    include: {
      deposits: true,
    },
  },
  paymentDeposits: true,
} as const;

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_RELATIONS;
}>;

type TransactionClient = Prisma.TransactionClient;

export interface OrderMeta {
  paymentMethod: string | null;
  totalAmount: number;
  depositAmount: number;
  depositRequired: boolean;
  depositPaid: boolean;
}

interface PaymentPipelineParams {
  orderId: string;
  buyerId: string;
  paymentMethod: SupportedPaymentMethod;
  requiresDeposit: boolean;
  totalAmount: Prisma.Decimal;
  depositAmount: Prisma.Decimal;
  note?: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly depositRate = new Prisma.Decimal(ESCROW_RULES.DEPOSIT_RATE);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CartService))
    private cartService: CartService,
    @Inject(forwardRef(() => ShippingDemoService))
    private shippingService: ShippingDemoService,
    private readonly transferService: TransferService,
  ) { }
  /**
   * Tạo order mới từ listing
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const paymentMethod = this.normalizePaymentMethod(dto.paymentMethod);
    if (paymentMethod === 'COD' && dto.isDeposit) {
      throw new BadRequestException('COD does not support deposit');
    }
    const orderId = await this.prisma.$transaction(
      async (tx) => {
        const listing = await tx.listing.findUnique({
          where: { listing_id: dto.listingId },
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
        });

        if (!listing) {
          throw new NotFoundException('Listing not found');
        }

        if (listing.status !== 'APPROVED' && listing.status !== 'ACTIVE') {
          throw new BadRequestException(
            'Listing is not available for purchase',
          );
        }

        if (listing.seller_id === buyerId) {
          throw new BadRequestException('Cannot buy your own listing');
        }

        const existingOrder = await tx.order.findFirst({
          where: {
            listing_id: dto.listingId,
            status: {
              in: [
                OrderStatus.PENDING,
                OrderStatus.DEPOSITED,
                OrderStatus.CONFIRMED,
              ],
            },
          },
          select: { order_id: true },
        });

        if (existingOrder) {
          throw new BadRequestException(
            'This listing already has a pending order',
          );
        }

        const totalAmount = new Prisma.Decimal(listing.vehicle.price);
        const requiresDeposit = dto.isDeposit ?? false;
        const depositAmount = this.calculateDepositAmount(
          totalAmount,
          requiresDeposit,
        );

        const order = await tx.order.create({
          data: {
            buyer_id: buyerId,
            listing_id: dto.listingId,
            deposit_amount: depositAmount,
            status: OrderStatus.PENDING,
            created_at: new Date(),
          },
        });

        await tx.orderDetail.create({
          data: {
            order_id: order.order_id,
            listing_id: dto.listingId,
            vehicle_id: listing.vehicle_id,
            quantity: 1,
            unit_price: listing.vehicle.price,
            total_price: listing.vehicle.price,
            created_at: new Date(),
          },
        });

        await this.ensureOrderAddress(tx, {
          orderId: order.order_id,
          buyerId,
          shippingAddressId: dto.shippingAddressId,
          deliveryAddress: dto.deliveryAddress,
          deliveryPhone: dto.deliveryPhone,
        });

        await this.createPaymentPipeline(tx, {
          orderId: order.order_id,
          buyerId,
          paymentMethod,
          requiresDeposit,
          totalAmount,
          depositAmount,
          note: dto.note,
        });

        // Đánh dấu listing là SOLD ngay khi tạo order
        await tx.listing.update({
          where: { listing_id: dto.listingId },
          data: { status: 'SOLD' },
        });

        await tx.notification.create({
          data: {
            user_id: listing.seller_id,
            type: 'ORDER',
            title: 'New Order',
            message: `You have a new order for ${listing.vehicle.brand} ${listing.vehicle.model}`,
            created_at: new Date(),
          },
        });

        return order.order_id;
      },
      { timeout: 15000 },
    );

    const order = await this.fetchOrderWithRelations(orderId);
    return {
      success: true,
      data: this.withMeta(order),
    };
  }

  /**
   * Tạo order từ giỏ hàng (hỗ trợ nhiều items)
   */
  async createOrderFromCart(buyerId: string, dto: CreateOrderFromCartDto) {
    const paymentMethod = this.normalizePaymentMethod(dto.paymentMethod);
    const cartData = await this.cartService.getCartForOrder(buyerId);

    if (!cartData.items || cartData.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const itemsBySeller = cartData.items.reduce(
      (acc, item) => {
        if (!item.listing || !item.listing.seller_id) {
          throw new BadRequestException('Listing information is not available');
        }
        const sellerId = item.listing.seller_id;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }
        acc[sellerId].push(item);
        return acc;
      },
      {} as Record<string, typeof cartData.items>,
    );

    const createdOrderIds: string[] = [];

    await this.prisma.$transaction(
      async (tx) => {
        for (const [sellerId, items] of Object.entries(itemsBySeller)) {
          const totalAmountNumber = items.reduce(
            (sum, item) => sum + item.totalPrice,
            0,
          );
          const totalAmount = new Prisma.Decimal(totalAmountNumber);
          const requiresDeposit = dto.isDeposit ?? false;
          const depositAmount = this.calculateDepositAmount(
            totalAmount,
            requiresDeposit,
          );

          const order = await tx.order.create({
            data: {
              buyer_id: buyerId,
              listing_id: items[0].listingId,
              deposit_amount: depositAmount,
              status: OrderStatus.PENDING,
              created_at: new Date(),
            },
          });

          for (const item of items) {
            await tx.orderDetail.create({
              data: {
                order_id: order.order_id,
                listing_id: item.listingId,
                vehicle_id: item.vehicleId,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
                created_at: new Date(),
              },
            });
          }

          await this.ensureOrderAddress(tx, {
            orderId: order.order_id,
            buyerId,
            shippingAddressId: dto.shippingAddressId,
            deliveryAddress: dto.deliveryAddress,
            deliveryPhone: dto.deliveryPhone,
          });

          await this.createPaymentPipeline(tx, {
            orderId: order.order_id,
            buyerId,
            paymentMethod,
            requiresDeposit,
            totalAmount,
            depositAmount,
            note: dto.note,
          });

          // Đánh dấu tất cả listings là SOLD
          const listingIds = items.map((item) => item.listingId);
          await tx.listing.updateMany({
            where: { listing_id: { in: listingIds } },
            data: { status: 'SOLD' },
          });

          await tx.notification.create({
            data: {
              user_id: sellerId,
              type: 'ORDER',
              title: 'New Order',
              message: `You have a new order with ${items.length} products`,
              created_at: new Date(),
            },
          });

          createdOrderIds.push(order.order_id);
        }

        await tx.cartItem.deleteMany({
          where: { cart_id: cartData.cartId },
        });
      },
      { timeout: 15000 },
    );

    const orders = await this.prisma.order.findMany({
      where: { order_id: { in: createdOrderIds } },
      include: ORDER_RELATIONS,
      orderBy: { created_at: 'desc' },
    });

    return {
      success: true,
      message: `Created ${orders.length} order(s) successfully`,
      data: orders.map((order) => this.withMeta(order)),
    };
  }

  /**
   * Lấy danh sách orders của buyer
   */
  async getMyOrders(buyerId: string, status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: {
        buyer_id: buyerId,
        ...(status && { status }),
      },
      include: ORDER_RELATIONS,
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      success: true,
      data: orders.map((order) => this.withMeta(order)),
    };
  }

  /**
   * Lấy danh sách orders cho seller (từ listings của seller)
   */
  async getOrdersForSeller(sellerId: string, status?: OrderStatus) {
    const orders = await this.prisma.order.findMany({
      where: {
        listing: {
          seller_id: sellerId,
        },
        ...(status && { status }),
      },
      include: ORDER_RELATIONS,
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      success: true,
      data: orders.map((order) => this.withMeta(order)),
    };
  }

  /**
   * Lấy chi tiết order
   */
  async getOrderById(orderId: string, userId: string) {
    const order = await this.fetchOrderWithRelations(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyer_id !== userId && order.listing.seller_id !== userId) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return {
      success: true,
      data: this.withMeta(order),
    };
  }

  /**
   * Seller xác nhận đơn hàng 
   */
  async confirmOrder(orderId: string, sellerId: string, note?: string) {
    const order = await this.fetchOrderWithRelations(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.listing.seller_id !== sellerId) {
      throw new ForbiddenException('You are not the seller of this order');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.DEPOSITED) {
      throw new BadRequestException('Only pending or deposited orders can be confirmed by the seller');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmed_at: new Date(),
      },
      include: ORDER_RELATIONS,
    });

    await this.prisma.notification.create({
      data: {
        user_id: order.buyer_id,
        type: 'ORDER',
        title: 'Order Confirmed',
        message: `Your order for ${order.listing.vehicle.brand} ${order.listing.vehicle.model} has been confirmed by the seller${note ? ': ' + note : ''}`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: this.withMeta(updatedOrder),
    };
  }

  /**
   * Seller từ chối đơn hàng (Phase 2)
   */
  async rejectOrder(orderId: string, sellerId: string, reason: string) {
    const order = await this.fetchOrderWithRelations(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.listing.seller_id !== sellerId) {
      throw new ForbiddenException('You are not the seller of this order');
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.DEPOSITED) {
      throw new BadRequestException('Only pending or deposited orders can be rejected by the seller');
    }

    const depositPaid = this.isDepositPaid(order);

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.CANCELLED_BY_SELLER,
      },
      include: ORDER_RELATIONS,
    });

    // Chuyển tất cả listings của order về ACTIVE
    const listingIds = order.orderDetails.map((d) => d.listing_id);
    if (!listingIds.includes(order.listing_id)) {
      listingIds.push(order.listing_id);
    }
    await this.prisma.listing.updateMany({
      where: { listing_id: { in: listingIds } },
      data: { status: 'ACTIVE' },
    });

    if (depositPaid) {
      await this.prisma.paymentDeposit.updateMany({
        where: { order_id: orderId },
        data: {
          status: 'REFUNDED',
          note: reason ? `Seller rejected: ${reason}` : undefined,
        },
      });

      await this.prisma.payment.updateMany({
        where: { order_id: orderId },
        data: { status: PaymentStatus.FAILED },
      });

      // Scenario 3: Seller Rejects -> Refund deposit to Buyer (DRAFTING)
      try {
        await this.transferService.createSellerRejectRefund(updatedOrder);
        this.logger.log(`[Escrow] Created DRAFTING refund transfer for Order ${orderId} (Seller Reject)`);
      } catch (err) {
        this.logger.error(`[Escrow] Failed to create refund transfer for Order ${orderId}`, err.stack);
      }
    }

    await this.prisma.notification.create({
      data: {
        user_id: order.buyer_id,
        type: 'ORDER',
        title: 'Order Cancelled by Seller',
        message: `The order for ${order.listing.vehicle.brand} ${order.listing.vehicle.model} has been cancelled by the seller. Reason: ${reason}`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: this.withMeta(updatedOrder),
      message: 'Order rejected successfully',
    };
  }

  /**
   * Buyer hủy đơn hàng
   */
  async cancelOrder(orderId: string, userId: string, reason: string) {
    const order = await this.fetchOrderWithRelations(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyer_id !== userId) {
      throw new ForbiddenException('You are not the buyer of this order');
    }

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        'Cannot cancel confirmed or completed orders',
      );
    }

    const depositPaid = this.isDepositPaid(order);
    // CRITICAL: Capture the previous status BEFORE updating to CANCELLED_BY_BUYER
    const previousStatus = order.status;

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.CANCELLED_BY_BUYER,
      },
      include: ORDER_RELATIONS,
    });

    // Chuyển tất cả listings của order về APPROVED (hoặc ACTIVE)
    const listingIds = order.orderDetails.map((d) => d.listing_id);
    if (!listingIds.includes(order.listing_id)) {
      listingIds.push(order.listing_id);
    }
    await this.prisma.listing.updateMany({
      where: { listing_id: { in: listingIds } },
      data: { status: 'APPROVED' },
    });

    if (depositPaid) {
      await this.prisma.paymentDeposit.updateMany({
        where: { order_id: orderId },
        data: {
          status: 'REFUNDED',
          note: reason ? `Buyer cancelled: ${reason}` : undefined,
        },
      });

      await this.prisma.payment.updateMany({
        where: { order_id: orderId },
        data: { status: PaymentStatus.FAILED },
      });

      // Scenario 4: Buyer Cancels -> pass the PREVIOUS status to determine refund vs compensation
      try {
        // We pass the order with the PREVIOUS status so TransferService knows the context
        const orderWithPreviousStatus = { ...updatedOrder, status: previousStatus };
        await this.transferService.createBuyerCancelTransfer(orderWithPreviousStatus);
        this.logger.log(`[Escrow] Created DRAFTING transfer for Order ${orderId} (Buyer Cancel, was ${previousStatus})`);
      } catch (err) {
        this.logger.error(`[Escrow] Failed to create transfer for Order ${orderId}`, err.stack);
      }
    }

    await this.prisma.notification.create({
      data: {
        user_id: order.listing.seller_id,
        type: 'ORDER',
        title: 'Order Cancelled',
        message: `The order for ${order.listing.vehicle.brand} ${order.listing.vehicle.model} has been cancelled. Reason: ${reason}`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: this.withMeta(updatedOrder),
      message: 'Order cancelled successfully',
    };
  }

  /**
   * Cập nhật order status (từ payment webhook)
   * Đây là nơi tích hợp shipping tự động sau khi thanh toán thành công
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    options?: {
      paymentMethod?: string;
      paidAmount?: number;
      paymentCode?: number | string;
    },
  ) {
    // Bước 1: Transaction chỉ chứa write operations
    const txResult = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { order_id: orderId },
          include: {
            listing: {
              include: {
                vehicle: true,
                seller: true,
              },
            },
            payments: true,
            paymentDeposits: true,
          },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        let nextStatus = status;
        if (status === OrderStatus.DEPOSITED || status === OrderStatus.PAID) {
          await tx.payment.updateMany({
            where: {
              order_id: orderId,
              status: PaymentStatus.PENDING,
            },
            data: {
              status: PaymentStatus.SUCCESS,
              method: (options?.paymentMethod ?? 'PAYOS').toUpperCase(),
            },
          });

          await tx.paymentDeposit.updateMany({
            where: { order_id: orderId },
            data: {
              status: 'SUCCESS',
              note: options?.paymentCode
                ? `Payment code: ${options.paymentCode}`
                : undefined,
            },
          });
        }

        await tx.order.update({
          where: { order_id: orderId },
          data: {
            status: nextStatus,
            ...(nextStatus === OrderStatus.CONFIRMED && {
              confirmed_at: new Date(),
            }),
          },
        });

        if (status === OrderStatus.DEPOSITED || status === OrderStatus.PAID) {
          await tx.listing.update({
            where: { listing_id: order.listing_id },
            data: { status: 'RESERVED' },
          });
        }

        return order;
      },
      { timeout: 15000 },
    );

    // Bước 2: Tạo notification bên ngoài transaction
    if (status === OrderStatus.DEPOSITED || status === OrderStatus.PAID) {
      await this.prisma.notification.createMany({
        data: [
          {
            user_id: txResult.buyer_id,
            type: 'ORDER',
            title: 'Payment Successful',
            message: `Payment successful for ${txResult.listing.vehicle.brand} ${txResult.listing.vehicle.model}`,
            created_at: new Date(),
          },
          {
            user_id: txResult.listing.seller_id,
            type: 'ORDER',
            title: 'Order Paid',
            message: `The order for ${txResult.listing.vehicle.brand} ${txResult.listing.vehicle.model} has been paid`,
            created_at: new Date(),
          },
        ],
      });

      // 🔥 TỰ ĐỘNG TẠO SHIPMENT (bất đồng bộ)
      this.shippingService.createShipmentFromOrder(orderId).catch(err => {
        this.logger.error(`Auto-create shipment failed for order ${orderId}: ${err.message}`);
      });
    }

    // Bước 3: Fetch full order với relations bên ngoài transaction
    const result = await this.fetchOrderWithRelations(orderId);

    return {
      success: true,
      data: this.withMeta(result),
    };
  }

  /**
   * Hoàn thành đơn hàng (buyer xác nhận)
   */
  async completeOrder(orderId: string, buyerId: string) {
    const order = await this.fetchOrderWithRelations(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyer_id !== buyerId) {
      throw new ForbiddenException('You are not the buyer of this order');
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed orders can be completed');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
      },
      include: ORDER_RELATIONS,
    });

    await this.prisma.notification.create({
      data: {
        user_id: order.listing.seller_id,
        type: 'ORDER',
        title: 'Order Completed',
        message: `The order for ${order.listing.vehicle.brand} ${order.listing.vehicle.model} has been completed`,
        created_at: new Date(),
      },
    });

    // Scenario 1: Happy Path -> Payout to Seller minus 7% platform fee (DRAFTING)
    try {
      await this.transferService.createPayoutForCompletedOrder(updatedOrder);
      this.logger.log(`[Escrow] Created DRAFTING payout transfer for Order ${orderId} (Completed)`);
    } catch (err) {
      this.logger.error(`[Escrow] Failed to create payout transfer for Order ${orderId}`, err.stack);
    }

    return {
      success: true,
      data: this.withMeta(updatedOrder),
    };
  }

  // ==================== PRIVATE METHODS ====================

  private normalizePaymentMethod(method?: string): SupportedPaymentMethod {
    const normalized = (method ?? 'PAYOS').trim().toUpperCase();
    if (normalized !== 'COD' && normalized !== 'PAYOS') {
      throw new BadRequestException('Unsupported payment method');
    }
    return normalized;
  }

  private calculateDepositAmount(
    totalAmount: Prisma.Decimal,
    requiresDeposit: boolean,
  ) {
    if (!requiresDeposit) {
      return totalAmount;
    }
    const multiplied = totalAmount.mul(this.depositRate);
    const rounded = Math.round(Number(multiplied.toString()) * 100) / 100;
    return new Prisma.Decimal(rounded);
  }

  private async ensureOrderAddress(
    tx: TransactionClient,
    params: {
      orderId: string;
      buyerId: string;
      shippingAddressId?: string;
      deliveryAddress?: string;
      deliveryPhone?: string;
    },
  ) {
    if (!params.shippingAddressId && !params.deliveryAddress) {
      return;
    }

    let snapshot: string | null = null;
    let addressId: string | undefined;

    if (params.shippingAddressId) {
      const address = await tx.address.findUnique({
        where: { address_id: params.shippingAddressId },
      });

      if (!address || address.user_id !== params.buyerId) {
        throw new BadRequestException('Invalid shipping address');
      }
      addressId = address.address_id;
      snapshot = this.buildAddressSnapshot(
        address,
        params.deliveryAddress,
        params.deliveryPhone,
      );
    } else if (params.deliveryAddress) {
      snapshot = this.buildAddressSnapshot(
        undefined,
        params.deliveryAddress,
        params.deliveryPhone,
      );
    }

    if (!snapshot) {
      return;
    }

    await tx.orderAddress.create({
      data: {
        order_id: params.orderId,
        address_id: addressId,
        address_type: 'SHIPPING',
        address_snapshot: snapshot,
        created_at: new Date(),
      },
    });
  }

  private async createPaymentPipeline(
    tx: TransactionClient,
    params: PaymentPipelineParams,
  ) {
    const payment = await tx.payment.create({
      data: {
        order_id: params.orderId,
        method: params.paymentMethod,
        amount: params.depositAmount,
        status: PaymentStatus.PENDING,
        created_at: new Date(),
      },
    });

    if (params.requiresDeposit) {
      await tx.paymentDeposit.create({
        data: {
          order_id: params.orderId,
          payment_id: payment.payment_id,
          buyer_id: params.buyerId,
          amount: params.depositAmount,
          note: params.note ?? 'DEPOSIT_PENDING',
          status: 'PENDING',
          created_at: new Date(),
        },
      });
    }
  }

  private sumOrderDetails(details: OrderWithRelations['orderDetails']) {
    return details.reduce(
      (sum, detail) => sum.add(detail.total_price),
      new Prisma.Decimal(0),
    );
  }

  private buildOrderMeta(order: OrderWithRelations): OrderMeta {
    const totalAmount = this.sumOrderDetails(order.orderDetails);
    const depositAmount = Number(order.deposit_amount);
    const depositPaid = this.isDepositPaid(order);
    const paymentMethod = this.resolvePrimaryPaymentMethod(order.payments);

    return {
      paymentMethod,
      totalAmount: this.toNumber(totalAmount),
      depositAmount: depositAmount,
      depositRequired: depositAmount > 0,
      depositPaid,
    };
  }

  private withMeta(order: OrderWithRelations | null) {
    if (!order) {
      return order;
    }
    return {
      ...order,
      meta: this.buildOrderMeta(order),
    };
  }

  private isDepositPaid(order: OrderWithRelations) {
    if (order.payments.length === 0) return false;
    const payment = order.payments[0];

    const hasCompletedDeposit = order.paymentDeposits?.some(
      (d) => d.status === 'SUCCESS',
    );

    return payment.status === PaymentStatus.SUCCESS && hasCompletedDeposit;
  }

  private resolvePrimaryPaymentMethod(
    payments: OrderWithRelations['payments'],
  ) {
    const payment = payments[0];
    return payment?.method?.toUpperCase() ?? null;
  }

  private async fetchOrderWithRelations(orderId: string) {
    return this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: ORDER_RELATIONS,
    });
  }

  private buildAddressSnapshot(
    address?: Address | null,
    overrideAddress?: string,
    deliveryPhone?: string,
  ) {
    return JSON.stringify({
      label: address?.label ?? null,
      recipientName: address?.recipient_name ?? null,
      phone: deliveryPhone ?? address?.phone ?? null,
      addressLine1: overrideAddress ?? address?.address_line1 ?? null,
      addressLine2: address?.address_line2 ?? null,
      ward: address?.ward ?? null,
      district: address?.district ?? null,
      city: address?.city ?? null,
      country: address?.country ?? null,
      postalCode: address?.postal_code ?? null,
    });
  }

  private toNumber(value?: Prisma.Decimal | null) {
    if (!value) {
      return 0;
    }
    return Number(value.toString());
  }
}