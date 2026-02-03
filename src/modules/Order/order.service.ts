import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { OrderStatus } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import { CartService } from '../Cart/cart.service';

@Injectable()
export class OrderService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => CartService))
    private cartService: CartService,
  ) {}

  /**
   * Tạo order mới từ listing
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    // Kiểm tra listing
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: dto.listingId },
      include: {
        vehicle: true,
        seller: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
          },
        },
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

    // Kiểm tra xem đã có order pending/deposited cho listing này chưa
    const existingOrder = await this.prisma.order.findFirst({
      where: {
        listing_id: dto.listingId,
        status: { in: ['PENDING', 'DEPOSITED'] },
      },
    });

    if (existingOrder) {
      throw new BadRequestException(
        'This listing already has a pending order',
      );
    }

    // Tạo order
    const order = await this.prisma.order.create({
      data: {
        buyer_id: buyerId,
        listing_id: dto.listingId,
        deposit_amount: listing.vehicle.price,
        status: OrderStatus.PENDING,
        created_at: new Date(),
      },
      include: {
        listing: {
          include: {
            vehicle: true,
            seller: {
              select: {
                user_id: true,
                full_name: true,
                email: true,
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
      },
    });

    // Tạo order detail
    await this.prisma.orderDetail.create({
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

    // Tạo order address nếu có
    if (dto.shippingAddressId) {
      const address = await this.prisma.address.findUnique({
        where: { address_id: dto.shippingAddressId },
      });

      if (address && address.user_id === buyerId) {
        await this.prisma.orderAddress.create({
          data: {
            order_id: order.order_id,
            address_id: dto.shippingAddressId,
            address_type: 'SHIPPING',
            created_at: new Date(),
          },
        });
      }
    }

    // Tạo notification cho seller
    await this.prisma.notification.create({
      data: {
        user_id: listing.seller_id,
        type: 'ORDER',
        title: 'Đơn hàng mới',
        message: `Bạn có đơn hàng mới cho ${listing.vehicle.brand} ${listing.vehicle.model}`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: order,
    };
  }

  /**
   * Tạo order từ giỏ hàng (hỗ trợ nhiều items)
   */
  async createOrderFromCart(buyerId: string, dto: CreateOrderFromCartDto) {
    // Lấy thông tin cart đã validate
    const cartData = await this.cartService.getCartForOrder(buyerId);

    if (!cartData.items || cartData.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Nhóm items theo seller (mỗi seller tạo 1 order riêng)
    const itemsBySeller = cartData.items.reduce(
      (acc, item) => {
        const sellerId = item.listing.seller_id;
        if (!acc[sellerId]) {
          acc[sellerId] = [];
        }
        acc[sellerId].push(item);
        return acc;
      },
      {} as Record<string, typeof cartData.items>,
    );

    const createdOrders: string[] = [];

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
    await this.prisma.$transaction(async (tx) => {
      for (const [sellerId, items] of Object.entries(itemsBySeller)) {
        // Tính tổng tiền cho order này
        const totalAmount = items.reduce(
          (sum, item) => sum + item.totalPrice,
          0,
        );

        // Tạo order - sử dụng listing_id của item đầu tiên làm đại diện
        const order = await tx.order.create({
          data: {
            buyer_id: buyerId,
            listing_id: items[0].listingId, // Reference listing
            deposit_amount: totalAmount,
            status: OrderStatus.PENDING,
            created_at: new Date(),
          },
        });

        // Tạo order details cho từng item
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

        // Tạo order address nếu có
        if (dto.shippingAddressId) {
          const address = await tx.address.findUnique({
            where: { address_id: dto.shippingAddressId },
          });

          if (address && address.user_id === buyerId) {
            await tx.orderAddress.create({
              data: {
                order_id: order.order_id,
                address_id: dto.shippingAddressId,
                address_type: 'SHIPPING',
                created_at: new Date(),
              },
            });
          }
        }

        // Tạo notification cho seller
        await tx.notification.create({
          data: {
            user_id: sellerId,
            type: 'ORDER',
            title: 'Đơn hàng mới',
            message: `Bạn có đơn hàng mới với ${items.length} sản phẩm`,
            created_at: new Date(),
          },
        });

        createdOrders.push(order.order_id);
      }

      // Xóa giỏ hàng sau khi tạo orders thành công
      await tx.cartItem.deleteMany({
        where: { cart_id: cartData.cartId },
      });
    });

    // Lấy thông tin chi tiết của các orders đã tạo
    const orders = await this.prisma.order.findMany({
      where: {
        order_id: { in: createdOrders },
      },
      include: {
        listing: {
          include: {
            vehicle: true,
            seller: {
              select: {
                user_id: true,
                full_name: true,
                email: true,
              },
            },
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
        buyer: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return {
      success: true,
      message: `Created ${orders.length} order(s) successfully`,
      data: orders,
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
      include: {
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
        orderDetails: {
          include: {
            vehicle: true,
          },
        },
        payments: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      success: true,
      data: orders,
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
      include: {
        buyer: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        listing: {
          include: {
            vehicle: true,
          },
        },
        orderDetails: {
          include: {
            vehicle: true,
          },
        },
        payments: true,
        orderAddresses: {
          include: {
            address: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return {
      success: true,
      data: orders,
    };
  }

  /**
   * Lấy chi tiết order
   */
  async getOrderById(orderId: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        buyer: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
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
        orderDetails: {
          include: {
            vehicle: true,
          },
        },
        orderAddresses: {
          include: {
            address: true,
          },
        },
        payments: true,
        paymentDeposits: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Kiểm tra quyền truy cập (buyer hoặc seller)
    if (
      order.buyer_id !== userId &&
      order.listing.seller_id !== userId
    ) {
      throw new ForbiddenException('You do not have access to this order');
    }

    return {
      success: true,
      data: order,
    };
  }

  /**
   * Seller xác nhận đơn hàng
   */
  async confirmOrder(orderId: string, sellerId: string, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        listing: {
          include: {
            vehicle: true,
            seller: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.listing.seller_id !== sellerId) {
      throw new ForbiddenException('You are not the seller of this order');
    }

    if (order.status !== 'DEPOSITED') {
      throw new BadRequestException(
        'Only deposited orders can be confirmed',
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        confirmed_at: new Date(),
      },
      include: {
        buyer: {
          select: {
            user_id: true,
            full_name: true,
          },
        },
        listing: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    // Tạo notification cho buyer
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
      data: updatedOrder,
    };
  }

  /**
   * Buyer hủy đơn hàng
   */
  async cancelOrder(orderId: string, userId: string, reason: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        listing: {
          include: {
            vehicle: true,
            seller: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.buyer_id !== userId) {
      throw new ForbiddenException('You are not the buyer of this order');
    }

    if (order.status === 'COMPLETED' || order.status === 'CONFIRMED') {
      throw new BadRequestException(
        'Cannot cancel confirmed or completed orders',
      );
    }

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
      },
      include: {
        listing: {
          include: {
            vehicle: true,
          },
        },
      },
    });

    // Cập nhật listing về ACTIVE
    await this.prisma.listing.update({
      where: { listing_id: order.listing_id },
      data: { status: 'ACTIVE' },
    });

    // Tạo notification cho seller
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
      data: updatedOrder,
      message: 'Order cancelled successfully',
    };
  }

  /**
   * Cập nhật order status (từ payment webhook)
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    paymentLinkId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
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

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status,
        ...(status === 'DEPOSITED' && { confirmed_at: new Date() }),
      },
    });

    // Nếu là DEPOSITED thành công, cập nhật listing
    if (status === 'DEPOSITED') {
      await this.prisma.listing.update({
        where: { listing_id: order.listing_id },
        data: { status: 'SOLD' },
      });

      // Tạo notifications
      await this.prisma.notification.create({
        data: {
          user_id: order.buyer_id,
          type: 'ORDER',
          title: 'Thanh toán thành công',
          message: `Thanh toán thành công cho ${order.listing.vehicle.brand} ${order.listing.vehicle.model}`,
          created_at: new Date(),
        },
      });

      await this.prisma.notification.create({
        data: {
          user_id: order.listing.seller_id,
          type: 'ORDER',
          title: 'Đơn hàng đã được thanh toán',
          message: `Đơn hàng ${order.listing.vehicle.brand} ${order.listing.vehicle.model} đã được thanh toán`,
          created_at: new Date(),
        },
      });
    }

    return {
      success: true,
      data: updatedOrder,
    };
  }

  /**
   * Hoàn thành đơn hàng
   */
  async completeOrder(orderId: string, sellerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
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

    if (order.listing.seller_id !== sellerId) {
      throw new ForbiddenException('You are not the seller of this order');
    }

    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('Only confirmed orders can be completed');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { order_id: orderId },
      data: {
        status: OrderStatus.COMPLETED,
      },
    });

    // Tạo notification cho buyer
    await this.prisma.notification.create({
      data: {
        user_id: order.buyer_id,
        type: 'ORDER',
        title: 'Đơn hàng hoàn thành',
        message: `Đơn hàng ${order.listing.vehicle.brand} ${order.listing.vehicle.model} đã hoàn thành`,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: updatedOrder,
    };
  }
}
