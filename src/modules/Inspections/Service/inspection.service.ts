import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InspectionRequestStatus, InspectionStatus, NotificationType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateInspectionDto,
  UpdateInspectionDto,
  InspectionQueryDto,
  CancelInspectionDto,
  UpdateReportDto,
} from '../DTOs/inspection.dto';

@Injectable()
export class InspectionService {
  constructor(private prisma: PrismaService) {}

  // ==================== CREATE ====================
  async create(userId: string, dto: CreateInspectionDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: dto.listingId },
      select: { status: true },
    });
    if (!listing) {
      throw new NotFoundException('Listing không tồn tại');
    }
    if (!['ACTIVE', 'APPROVED'].includes(listing.status)) {
      throw new BadRequestException('Listing không khả dụng để kiểm định');
    }

    return this.prisma.inspection.create({
      data: {
        listing_id: dto.listingId,
        requested_by_id: userId,
        scheduled_at: dto.scheduledAt,
        request_status: InspectionRequestStatus.PENDING,
      },
      include: {
        listing: { include: { vehicle: true } },
        requester: { select: { user_id: true, full_name: true, email: true } },
      },
    });
  }

  // ==================== FIND MY REQUESTS ====================
  async findMyRequests(userId: string, query: InspectionQueryDto) {
    const { listingId, requestStatus, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      requested_by_id: userId,
    };
    if (listingId) where.listing_id = listingId;
    if (requestStatus) where.request_status = requestStatus;

    const [total, items] = await Promise.all([
      this.prisma.inspection.count({ where }),
      this.prisma.inspection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          listing: { include: { vehicle: true } },
          inspector: { select: { user_id: true, full_name: true } },
        },
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================== FIND ALL (role‑based) ====================
  async findAll(userId: string, userRoleId: number, query: InspectionQueryDto) {
    const { listingId, requestStatus, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    let where: any = {};

    if (listingId) where.listing_id = listingId;
    if (requestStatus) where.request_status = requestStatus;

    if (userRoleId === 1) {
      // USER
      where.requested_by_id = userId;
    } else if (userRoleId === 2) {
      // INSPECTOR
      where.OR = [
        { inspector_id: userId },
        {
          request_status: InspectionRequestStatus.PENDING,
          inspector_id: null,
        },
      ];
    }
    // ADMIN (3) không có filter

    const [total, items] = await Promise.all([
      this.prisma.inspection.count({ where }),
      this.prisma.inspection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          listing: { include: { vehicle: true } },
          requester: { select: { user_id: true, full_name: true } },
          inspector: { select: { user_id: true, full_name: true } },
        },
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==================== FIND ONE ====================
  async findOne(id: string, userId: string, userRoleId: number) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspection_id: id },
      include: {
        listing: { include: { vehicle: true, seller: true } },
        requester: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
        inspector: {
          select: { user_id: true, full_name: true, email: true },
        },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection không tồn tại');
    }

    const isRequester = inspection.requested_by_id === userId;
    const isInspector = inspection.inspector_id === userId;
    const isAdmin = userRoleId === 3;

    const canViewAsInspector =
      userRoleId === 2 &&
      inspection.request_status === InspectionRequestStatus.PENDING &&
      inspection.inspector_id === null;

    if (!isRequester && !isInspector && !isAdmin && !canViewAsInspector) {
      throw new ForbiddenException('Bạn không có quyền xem inspection này');
    }

    return inspection;
  }

  // ==================== UPDATE (general) ====================
  async update(
    id: string,
    dto: UpdateInspectionDto,
    userId: string,
    userRoleId: number,
  ) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspection_id: id },
      select: {
        inspector_id: true,
        request_status: true,
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection không tồn tại');
    }

    const isInspector = inspection.inspector_id === userId;
    const isAdmin = userRoleId === 3;

    if (!isInspector && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền cập nhật inspection này');
    }

    if (
      inspection.request_status === InspectionRequestStatus.COMPLETED ||
      inspection.request_status === InspectionRequestStatus.CANCELLED
    ) {
      throw new BadRequestException('Không thể cập nhật inspection đã kết thúc');
    }

    try {
      const updated = await this.prisma.inspection.update({
        where: { inspection_id: id },
        data: dto,
        include: {
          listing: true,
          inspector: { select: { user_id: true, full_name: true } },
        },
      });
      return updated;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new BadRequestException('Dữ liệu đã thay đổi, vui lòng thử lại');
      }
      throw error;
    }
  }

  // ==================== UPDATE REPORT (inspector completes) ====================
  async updateReport(id: string, dto: UpdateReportDto, userId: string) {
    try {
      const inspection = await this.prisma.inspection.update({
        where: {
          inspection_id: id,
          inspector_id: userId,
          request_status: InspectionRequestStatus.CONFIRMED,
        },
        data: {
          result_status: dto.resultStatus,
          report_url: dto.reportUrl,
          notes: dto.notes,
          valid_until: dto.validUntil,
          request_status: InspectionRequestStatus.COMPLETED,
        },
        include: {
          listing: true,
          requester: { select: { user_id: true, full_name: true } },
        },
      });
      return inspection;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ForbiddenException(
          'Không thể cập nhật báo cáo. Kiểm tra quyền hoặc trạng thái inspection.',
        );
      }
      throw error;
    }
  }

  // ==================== CANCEL ====================
// ==================== CANCEL ====================
async cancel(
  id: string,
  userId: string,
  userRoleId: number,
  dto?: CancelInspectionDto,
) {
  // Bắt buộc phải có lý do hủy
  if (!dto?.cancelReason) {
    throw new BadRequestException('Vui lòng cung cấp lý do hủy');
  }

  // Xây dựng điều kiện where và data update dựa trên role
  let whereCondition: any = { inspection_id: id };
  let updateData: any = {};
  let notificationTitle = '';
  let notificationMessage = '';

  if (userRoleId === 1) {
    // USER: chỉ hủy khi là người yêu cầu và đang PENDING -> chuyển CANCELLED
    whereCondition.requested_by_id = userId;
    whereCondition.request_status = InspectionRequestStatus.PENDING;
    updateData.request_status = InspectionRequestStatus.CANCELLED;
    updateData.notes = `Người dùng hủy: ${dto.cancelReason}`;
    notificationTitle = 'Yêu cầu kiểm định đã bị hủy';
    notificationMessage = `Yêu cầu kiểm định cho listing đã bị hủy.`;
  } else if (userRoleId === 2) {
    // INSPECTOR: chỉ hủy khi là inspector được gán và đang PENDING hoặc CONFIRMED
    // => reset về PENDING, xóa inspector_id
    whereCondition.inspector_id = userId;
    whereCondition.request_status = {
      in: [
        InspectionRequestStatus.PENDING,
        InspectionRequestStatus.CONFIRMED,
      ],
    };
    updateData.request_status = InspectionRequestStatus.PENDING;
    updateData.inspector_id = null;
    updateData.notes = `Inspector hủy nhận: ${dto.cancelReason}`;
    notificationTitle = 'Inspector đã hủy nhận đơn kiểm định';
    notificationMessage = `Inspector đã hủy nhận đơn. Đơn đang chờ được tiếp nhận lại.`;
  } else if (userRoleId === 3) {
    // ADMIN: hủy bất kỳ đang PENDING hoặc CONFIRMED -> CANCELLED
    whereCondition.request_status = {
      in: [
        InspectionRequestStatus.PENDING,
        InspectionRequestStatus.CONFIRMED,
      ],
    };
    updateData.request_status = InspectionRequestStatus.CANCELLED;
    updateData.notes = `Admin hủy: ${dto.cancelReason}`;
    notificationTitle = 'Yêu cầu kiểm định đã bị hủy bởi quản trị viên';
    notificationMessage = `Yêu cầu kiểm định đã bị hủy bởi quản trị viên.`;
  } else {
    throw new ForbiddenException('Bạn không có quyền hủy inspection');
  }

  try {
    const inspection = await this.prisma.$transaction(async (prisma) => {
      // Lấy thông tin hiện tại để biết ai liên quan
      const current = await prisma.inspection.findUnique({
        where: { inspection_id: id },
        include: {
          requester: { select: { user_id: true, full_name: true } },
          inspector: { select: { user_id: true, full_name: true } },
        },
      });
      if (!current) throw new NotFoundException();

      // Thực hiện cập nhật
      const updated = await prisma.inspection.update({
        where: whereCondition,
        data: updateData,
        include: {
          requester: { select: { user_id: true, full_name: true } },
          inspector: { select: { user_id: true, full_name: true } },
        },
      });

      // Xác định ai sẽ nhận thông báo
      const notifiedUserIds: string[] = [];
      const cancelReasonText = ` Lý do: ${dto.cancelReason}`;

      if (userRoleId === 1) {
        // User hủy -> báo cho inspector (nếu có)
        if (current.inspector_id) notifiedUserIds.push(current.inspector_id);
      } else if (userRoleId === 2) {
        // Inspector hủy -> báo cho requester
        notifiedUserIds.push(current.requested_by_id);
      } else if (userRoleId === 3) {
        // Admin hủy -> báo cho cả requester và inspector (nếu có)
        notifiedUserIds.push(current.requested_by_id);
        if (current.inspector_id) notifiedUserIds.push(current.inspector_id);
      }

      // Tạo notifications
      for (const targetUserId of notifiedUserIds) {
        await prisma.notification.create({
          data: {
            user_id: targetUserId,
            type: NotificationType.INSPECTION,
            title: notificationTitle,
            message: notificationMessage + cancelReasonText,
            link: `/inspections/${updated.inspection_id}`,
            created_at: new Date(),
          },
        });
      }

      return updated;
    });

    return inspection;
  } catch (error) {
    if (error.code === 'P2025') {
      throw new BadRequestException(
        'Không thể hủy inspection. Kiểm tra trạng thái hoặc quyền.',
      );
    }
    throw error;
  }
}

  // ==================== ASSIGN TO SELF (inspector nhận) ====================
  async assignToSelf(id: string, userId: string) {
    try {
      const inspection = await this.prisma.$transaction(async (prisma) => {
        // Atomic update: chỉ thành công nếu inspector_id = null và status = PENDING
        const updated = await prisma.inspection.update({
          where: {
            inspection_id: id,
            inspector_id: null,
            request_status: InspectionRequestStatus.PENDING,
          },
          data: {
            inspector_id: userId,
            request_status: InspectionRequestStatus.CONFIRMED, // chuyển sang CONFIRMED khi đã nhận
          },
          include: {
            listing: { include: { vehicle: true } },
            requester: { select: { user_id: true, full_name: true } },
            inspector: { select: { user_id: true, full_name: true } },
          },
        });

        // Thông báo cho người yêu cầu
        await prisma.notification.create({
          data: {
            user_id: updated.requested_by_id,
            type: NotificationType.INSPECTION,
            title: 'Đơn kiểm định đã được tiếp nhận',
            message: `Inspector ${updated.inspector?.full_name || 'Đã được phân công'} đã nhận yêu cầu kiểm định cho xe ${updated.listing?.vehicle?.model || ''}.`,
            link: `/inspections/${updated.inspection_id}`,
            created_at: new Date(),
          },
        });

        return updated;
      });

      return inspection;
    } catch (error) {
      if (error.code === 'P2025') {
        throw new BadRequestException(
          'Inspection không còn khả dụng để nhận (đã có inspector hoặc không ở trạng thái PENDING)',
        );
      }
      throw error;
    }
  }
}