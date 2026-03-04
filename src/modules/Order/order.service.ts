import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  Prisma,
  OrderStatus,
  PaymentStatus,
  Address,
} from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import { CartService } from '../Cart/cart.service';
import {
  ESCROW_RULES,
  SupportedPaymentMethod,
} from './order.constants';

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
  private readonly depositThreshold = new Prisma.Decimal(
    ESCROW_RULES.DEPOSIT_THRESHOLD_AMOUNT,
  );
  private readonly depositRate = new Prisma.Decimal(ESCROW_RULES.DEPOSIT_RATE);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CartService))
    private cartService: CartService,
  ) {}

  /**
   * Tạo order mới từ listing
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const paymentMethod = this.normalizePaymentMethod(dto.paymentMethod);

    const orderId = await this.prisma.$transaction(async (tx) => {
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
          status: { in: [OrderStatus.PENDING, OrderStatus.DEPOSITED, OrderStatus.CONFIRMED] },
        },
        select: { order_id: true },
      });

      if (existingOrder) {
        throw new BadRequestException(
          'This listing already has a pending order',
        );
      }

      const totalAmount = new Prisma.Decimal(listing.vehicle.price);
      const requiresDeposit = this.requiresDeposit(totalAmount);
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

      await tx.notification.create({
        data: {
          user_id: listing.seller_id,
          type: 'ORDER',
          title: 'Đơn hàng mới',
          message: `Bạn có đơn hàng mới cho ${listing.vehicle.brand} ${listing.vehicle.model}`,
          created_at: new Date(),
        },
      });

      return order.order_id;
    });

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

    await this.prisma.$transaction(async (tx) => {
      for (const [sellerId, items] of Object.entries(itemsBySeller)) {
        const totalAmountNumber = items.reduce(
          (sum, item) => sum + item.totalPrice,
          0,
        );
        const totalAmount = new Prisma.Decimal(totalAmountNumber);
        const requiresDeposit = this.requiresDeposit(totalAmount);
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

        await tx.notification.create({
          data: {
            user_id: sellerId,
            type: 'ORDER',
            title: 'Đơn hàng mới',
            message: `Bạn có đơn hàng mới với ${items.length} sản phẩm`,
            created_at: new Date(),
          },
        });

        createdOrderIds.push(order.order_id);
      }

      await tx.cartItem.deleteMany({
        where: { cart_id: cartData.cartId },
      });
    });

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

    if (
      order.buyer_id !== userId &&
      order.listing.seller_id !== userId
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return {
      success: true,
      data: this.withMeta(order),
    };
  }

  /**
   * Seller xác nhận đơn hàng (chỉ dành cho COD)
   */
  async confirmOrder(orderId: string, sellerId: string, note?: string) {
    const order = await this.fetchOrderWithRelations(orderId);

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.listing.seller_id !== sellerId) {
      throw new ForbiddenException('You are not the seller of this order');
    }

    const paymentMethod = this.resolvePrimaryPaymentMethod(order.payments);
    if (paymentMethod !== 'COD') {
      throw new BadRequestException(
        'Only COD orders require manual confirmation',
      );
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Only pending COD orders can be confirmed',
      );
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
        title: 'Đơn hàng được xác nhận',
        message: `Đơn hàng ${order.listing.vehicle.brand} ${order.listing.vehicle.model} đã được xác nhận${note ? ': ' + note : ''}`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: this.withMeta(updatedOrder),
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

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
      },
      include: ORDER_RELATIONS,
    });

    await this.prisma.listing.update({
      where: { listing_id: order.listing_id },
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
    }

    await this.prisma.notification.create({
      data: {
        user_id: order.listing.seller_id,
        type: 'ORDER',
        title: 'Đơn hàng bị hủy',
        message: `Đơn hàng ${order.listing.vehicle.brand} ${order.listing.vehicle.model} đã bị hủy. Lý do: ${reason}`,
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
    const result = await this.prisma.$transaction(async (tx) => {
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
      if (status === OrderStatus.DEPOSITED) {
        nextStatus = OrderStatus.CONFIRMED;

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

      const updatedOrder = await tx.order.update({
        where: { order_id: orderId },
        data: {
          status: nextStatus,
          ...(nextStatus === OrderStatus.CONFIRMED && {
            confirmed_at: new Date(),
          }),
        },
        include: ORDER_RELATIONS,
      });

      if (status === OrderStatus.DEPOSITED) {
        await tx.listing.update({
          where: { listing_id: order.listing_id },
          data: { status: 'SOLD' },
        });

        await tx.notification.createMany({
          data: [
            {
              user_id: order.buyer_id,
              type: 'ORDER',
              title: 'Thanh toán thành công',
              message: `Thanh toán thành công cho ${order.listing.vehicle.brand} ${order.listing.vehicle.model}`,
              created_at: new Date(),
            },
            {
              user_id: order.listing.seller_id,
              type: 'ORDER',
              title: 'Đơn hàng đã được thanh toán',
              message: `Đơn hàng ${order.listing.vehicle.brand} ${order.listing.vehicle.model} đã được thanh toán`,
              created_at: new Date(),
            },
          ],
        });
      }

      return updatedOrder;
    });

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
        title: 'Đơn hàng hoàn thành',
        message: `Đơn hàng ${order.listing.vehicle.brand} ${order.listing.vehicle.model} đã hoàn thành`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: this.withMeta(updatedOrder),
    };
  }

  private normalizePaymentMethod(method?: string): SupportedPaymentMethod {
    const normalized = (method ?? 'PAYOS').trim().toUpperCase();
    if (
      normalized !== 'COD' &&
      normalized !== 'PAYOS'
    ) {
      throw new BadRequestException('Unsupported payment method');
    }
    return normalized as SupportedPaymentMethod;
  }

  private requiresDeposit(amount: Prisma.Decimal) {
    return amount.greaterThanOrEqualTo(this.depositThreshold);
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
    const depositRequired = this.requiresDeposit(totalAmount);
    const depositAmount = depositRequired
      ? order.deposit_amount
      : totalAmount;
    const depositPaid = this.isDepositPaid(order);
    const paymentMethod = this.resolvePrimaryPaymentMethod(order.payments);

    return {
      paymentMethod,
      totalAmount: this.toNumber(totalAmount),
      depositAmount: this.toNumber(depositAmount),
      depositRequired,
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
    const depositPaid = order.paymentDeposits.some((deposit) => {
      const status = (deposit.status ?? '').toUpperCase();
      return status === 'SUCCESS' || status === 'PAID';
    });

    if (depositPaid) {
      return true;
    }

    return order.payments.some(
      (payment) => payment.status === PaymentStatus.SUCCESS,
    );
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
