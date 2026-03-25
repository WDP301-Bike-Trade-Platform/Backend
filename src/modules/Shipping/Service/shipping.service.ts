// shipping.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ShipmentStatus, OrderStatus } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { ManualUpdateStatusDto, ShipmentQueryDto, ShipmentResponseDto } from '../DTOs/shipping.dto';
import { NotificationService } from 'src/modules/Notification/notification.service';

@Injectable()
export class ShippingDemoService {
  private readonly logger = new Logger(ShippingDemoService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Tạo shipment giả sau khi thanh toán thành công
   * (Chỉ ADMIN được gọi – controller đã check)
   */
  // shipping.service.ts
    async findAll(query: ShipmentQueryDto): Promise<{ total: number; items: ShipmentResponseDto[] }> {
    const { skip = 0, take = 10, status } = query;

    const where: any = {};
    if (status) {
        where.status = status;
    }

    const [total, shipments] = await this.prisma.$transaction([
        this.prisma.shipment.count({ where }),
        this.prisma.shipment.findMany({
        where,
        include: {
            trackings: {
            orderBy: { tracked_at: 'desc' },
            },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
        }),
    ]);

    return {
        total,
        items: shipments.map(s => this.mapToResponse(s)),
    };
    }
  async createShipmentFromOrder(orderId: string): Promise<ShipmentResponseDto> {
    // Kiểm tra order
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        orderDetails: true,
        orderAddresses: {
          where: { address_type: 'SHIPPING' },
          include: { address: true }
        }
      }
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PAID' && order.status !== 'DEPOSITED') {
      throw new BadRequestException('Order not ready for shipping');
    }

    const existing = await this.prisma.shipment.findUnique({
      where: { order_id: orderId }
    });
    if (existing) throw new BadRequestException('Shipment already exists');

    // Tạo dữ liệu giả
    const trackingNumber = 'DEMO' + Date.now();
    const carrier = 'Demo Carrier';
    const shippingFee = 35000; // 35k VND
    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // +3 ngày

    // Tạo shipment
    const shipment = await this.prisma.shipment.create({
      data: {
        order_id: orderId,
        tracking_number: trackingNumber,
        carrier: carrier,
        status: ShipmentStatus.PENDING,
        shipping_fee: shippingFee,
        estimated_delivery: estimatedDelivery,
        // items: tạo shipment items từ order details
        items: {
          create: order.orderDetails.map(detail => ({
            order_detail_id: detail.order_detail_id,
            quantity: detail.quantity
          }))
        }
      },
      include: { items: true }
    });

    // Tạo tracking đầu tiên
    await this.prisma.shipmentTracking.create({
      data: {
        shipment_id: shipment.shipment_id,
        status: 'Order has been created',
        location: 'Seller warehouse',
        description: 'Order is waiting to be picked up',
        tracked_at: new Date(),
      }
    });

    // Gửi thông báo
    await this.notificationService.createNotification({
      userId: order.buyer_id,
      type: 'ORDER',
      title: 'Shipment label created',
      message: `Tracking number: ${trackingNumber}. Estimated delivery: ${estimatedDelivery.toLocaleDateString('en-GB')}`,
      link: `/orders/${orderId}`,
    });

    return this.mapToResponse(shipment);
  }
  // shipping.service.ts (bổ sung method getMyShipments)

/**
 * Lấy danh sách shipments của user hiện tại (dựa trên userId và role)
 * - USER: lấy shipments của các order mà user là buyer hoặc seller
 * - ADMIN: lấy tất cả shipments
 */
async getMyShipments(
  userId: string,
  roleName: string,
  query: ShipmentQueryDto = {},
): Promise<{ total: number; items: ShipmentResponseDto[] }> {
  const { skip = 0, take = 10, status } = query;

  let where: any = {};

  // Nếu không phải ADMIN, lọc theo quyền của user
  if (roleName !== 'ADMIN') {
    // Lấy tất cả order_id mà user là buyer
    const ordersAsBuyer = await this.prisma.order.findMany({
      where: { buyer_id: userId },
      select: { order_id: true },
    });
    const buyerOrderIds = ordersAsBuyer.map(o => o.order_id);

    // Lấy tất cả order_id mà user là seller (thông qua listing)
    const listings = await this.prisma.listing.findMany({
      where: { seller_id: userId },
      select: { listing_id: true },
    });
    const listingIds = listings.map(l => l.listing_id);
    const ordersAsSeller = await this.prisma.order.findMany({
      where: { listing_id: { in: listingIds } },
      select: { order_id: true },
    });
    const sellerOrderIds = ordersAsSeller.map(o => o.order_id);

    const allOrderIds = [...new Set([...buyerOrderIds, ...sellerOrderIds])];
    where.order_id = { in: allOrderIds };
  }

  if (status) {
    where.status = status;
  }

  const [total, shipments] = await this.prisma.$transaction([
    this.prisma.shipment.count({ where }),
    this.prisma.shipment.findMany({
      where,
      include: {
        trackings: {
          orderBy: { tracked_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    total,
    items: shipments.map(s => this.mapToResponse(s)),
  };
}
  /**
   * Lấy shipment theo shipment ID (với kiểm tra quyền nếu user không phải admin)
   */
  async getShipmentById(
    shipmentId: string,
    userId?: string,
    roleName?: string,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { shipment_id: shipmentId },
      include: {
        trackings: {
          orderBy: { tracked_at: 'desc' }
        },
        order: true,
      }
    });
    if (!shipment) throw new NotFoundException('Shipment not found');

    // Kiểm tra quyền nếu user không phải admin
    if (roleName !== 'ADMIN' && userId) {
      const order = shipment.order;
      if (!order) throw new NotFoundException('Order not found');

      // Kiểm tra user là buyer
      const isBuyer = order.buyer_id === userId;
      
      // Kiểm tra user là seller
      let isSeller = false;
      if (order.listing_id) {
        const listing = await this.prisma.listing.findUnique({
          where: { listing_id: order.listing_id },
          select: { seller_id: true }
        });
        isSeller = listing?.seller_id === userId;
      }

      if (!isBuyer && !isSeller) {
        throw new BadRequestException('You do not have permission to view this shipment');
      }
    }

    return this.mapToResponse(shipment);
  }

  /**
   * Lấy shipment theo order (có kiểm tra quyền ở controller, nên service không cần check)
   * Nhận thêm userId, roleName để tương thích với controller
   */
  async getShipmentByOrder(
    orderId: string,
    userId?: string,
    roleName?: string,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { order_id: orderId },
      include: {
        trackings: {
          orderBy: { tracked_at: 'desc' }
        }
      }
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    return this.mapToResponse(shipment);
  }

  /**
   * Xác nhận người bán đã chuẩn bị hàng xong
   */
  async confirmShipmentReady(
    shipmentId: string,
    userId?: string,
    roleName?: string,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { shipment_id: shipmentId },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const updated = await this.prisma.shipment.update({
      where: { shipment_id: shipmentId },
      data: { shop_confirmed_at: new Date() },
      include: { trackings: true }
    });

    // Có thể thông báo cho buyer
    const order = await this.prisma.order.findUnique({
      where: { order_id: updated.order_id },
      select: { buyer_id: true }
    });
    if (order) {
      await this.notificationService.createNotification({
        userId: order.buyer_id,
        type: 'ORDER',
        title: 'Seller confirmed package preparation',
        message: 'Your order has been prepared by the seller and will soon be handed over to the carrier.',
        link: `/orders/${updated.order_id}`,
      });
    }

    return this.mapToResponse(updated);
  }

  /**
   * Cập nhật trạng thái thủ công
   */
  async updateStatusManually(
    shipmentId: string,
    dto: ManualUpdateStatusDto,
    userId?: string,
    roleName?: string,
  ): Promise<ShipmentResponseDto> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { shipment_id: shipmentId },
      include: { order: true }
    });
    if (!shipment) throw new NotFoundException('Shipment not found');

    // Cập nhật tracking mới
    await this.prisma.shipmentTracking.create({
      data: {
        shipment_id: shipmentId,
        status: dto.status,
        location: dto.location || 'Updating',
        description: dto.description || `Status changed to ${dto.status}`,
        tracked_at: new Date(),
      }
    });

    // Cập nhật shipment status và các mốc thời gian
    const updateData: any = { status: dto.status };
    if (dto.status === ShipmentStatus.DELIVERED) {
      updateData.delivered_at = new Date();
    } else if (dto.status === ShipmentStatus.PICKED_UP) {
      if (!shipment.shipped_at) updateData.shipped_at = new Date();
    } else if (dto.status === ShipmentStatus.CANCELLED) {
      updateData.cancelled_at = new Date();
    }

    const updated = await this.prisma.shipment.update({
      where: { shipment_id: shipmentId },
      data: updateData,
      include: { trackings: true }
    });

    // Gửi thông báo cho người mua
    await this.notificationService.createNotification({
      userId: shipment.order.buyer_id,
      type: 'ORDER',
      title: 'Shipping update',
      message: `Your order has changed status to: ${dto.status}`,
      link: `/orders/${shipment.order_id}`,
    });

    return this.mapToResponse(updated);
  }

  /**
   * Tự động chuyển trạng thái theo thời gian (dùng cron job)
   */
  async autoProgressShipments() {
    const shipments = await this.prisma.shipment.findMany({
      where: {
        status: { not: ShipmentStatus.DELIVERED },
        cancelled_at: null,
      },
      include: { order: true }
    });

    for (const shipment of shipments) {
      let newStatus: ShipmentStatus | null = null;
      const now = new Date();
      const createdAt = shipment.created_at;

      // Logic đơn giản: sau 1 ngày chuyển từ PENDING → PICKED_UP
      if (shipment.status === ShipmentStatus.PENDING && 
          now.getTime() - createdAt.getTime() > 24 * 60 * 60 * 1000) {
        newStatus = ShipmentStatus.PICKED_UP;
      }
      // Sau 2 ngày nữa → IN_TRANSIT
      else if (shipment.status === ShipmentStatus.PICKED_UP &&
               now.getTime() - createdAt.getTime() > 48 * 60 * 60 * 1000) {
        newStatus = ShipmentStatus.IN_TRANSIT;
      }
      // Sau 3 ngày nữa → OUT_FOR_DELIVERY
      else if (shipment.status === ShipmentStatus.IN_TRANSIT &&
               now.getTime() - createdAt.getTime() > 72 * 60 * 60 * 1000) {
        newStatus = ShipmentStatus.OUT_FOR_DELIVERY;
      }
      // Sau 4 ngày nữa → DELIVERED
      else if (shipment.status === ShipmentStatus.OUT_FOR_DELIVERY &&
               now.getTime() - createdAt.getTime() > 96 * 60 * 60 * 1000) {
        newStatus = ShipmentStatus.DELIVERED;
      }

      if (newStatus) {
        await this.updateStatusManually(shipment.shipment_id, {
          status: newStatus,
          location: 'Auto-system',
          description: `Automatically progressed to ${newStatus}`,
        });
      }
    }
  }

  private mapToResponse(shipment: any): ShipmentResponseDto {
    return {
      shipmentId: shipment.shipment_id,
      orderId: shipment.order_id,
      trackingNumber: shipment.tracking_number,
      carrier: shipment.carrier,
      status: shipment.status,
      shippingFee: shipment.shipping_fee.toNumber ? shipment.shipping_fee.toNumber() : shipment.shipping_fee,
      estimatedDelivery: shipment.estimated_delivery,
      deliveredAt: shipment.delivered_at,
      shippedAt: shipment.shipped_at,
      createdAt: shipment.created_at,
      updatedAt: shipment.updated_at,
      trackings: shipment.trackings?.map(t => ({
        trackingId: t.tracking_id,
        status: t.status,
        location: t.location,
        description: t.description,
        trackedAt: t.tracked_at,
      })),
    };
  }
}