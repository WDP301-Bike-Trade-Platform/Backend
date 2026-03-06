import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { InspectionRequestStatus, RoleName } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { CancelInspectionDto, CreateInspectionDto, InspectionQueryDto,UpdateInspectionDto } from '../DTOs/inspection.dto';

@Injectable()
export class InspectionService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateInspectionDto) {
    // Kiểm tra listing tồn tại và đang ACTIVE/APPROVED
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

    // Tạo inspection
    return this.prisma.inspection.create({
      data: {
        listing_id: dto.listingId,
        requested_by_id: userId,
        request_status: InspectionRequestStatus.PENDING,
      },
      include: {
        listing: { include: { vehicle: true } },
        requester: { select: { user_id: true, full_name: true, email: true } },
      },
    });
  }
  async findMyRequests(userId: string, query: InspectionQueryDto) {
  const { listingId, requestStatus, page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where: any = {
    requested_by_id: userId, // chỉ lấy các đơn do user này tạo
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
  async findAll(userId: string, userRoleId: number, query: InspectionQueryDto) {
    const { listingId, requestStatus, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (listingId) where.listing_id = listingId;
    if (requestStatus) where.request_status = requestStatus;

    // Phân quyền dữ liệu
    if (userRoleId === 1) {
      // USER chỉ thấy inspections do mình yêu cầu
      where.requested_by_id = userId;
    } else if (userRoleId === 2) {
      // INSPECTOR chỉ thấy inspections được gán cho mình
      where.inspector_id = userId;
    }
    // ADMIN thấy tất cả

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

  async findOne(id: string, userId: string, userRoleId: number) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspection_id: id },
      include: {
        listing: { include: { vehicle: true, seller: true } },
        requester: { select: { user_id: true, full_name: true, email: true, phone: true } },
        inspector: { select: { user_id: true, full_name: true, email: true } },
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection không tồn tại');
    }

    // Kiểm tra quyền truy cập
    const isRequester = inspection.requested_by_id === userId;
    const isInspector = inspection.inspector_id === userId;
    const isAdmin = userRoleId === 3;

    if (!isRequester && !isInspector && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền xem inspection này');
    }

    return inspection;
  }

  async update(id: string, dto: UpdateInspectionDto, userId: string, userRoleId: number) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspection_id: id },
      select: { inspector_id: true, request_status: true },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection không tồn tại');
    }

    // Kiểm tra quyền cập nhật
    const isInspector = inspection.inspector_id === userId;
    const isAdmin = userRoleId === 3;

    // Chỉ inspector được phân công hoặc admin mới được cập nhật
    if (!isInspector && !isAdmin) {
      throw new ForbiddenException('Bạn không có quyền cập nhật inspection này');
    }

    // Không cho phép cập nhật nếu đã hoàn thành hoặc hủy (tuỳ logic)
    if (inspection.request_status === 'COMPLETED' || inspection.request_status === 'CANCELLED') {
      throw new BadRequestException('Không thể cập nhật inspection đã kết thúc');
    }

    return this.prisma.inspection.update({
      where: { inspection_id: id },
      data: dto,
      include: {
        listing: true,
        inspector: { select: { user_id: true, full_name: true } },
      },
    });
  }

  // API riêng để inspector cập nhật báo cáo (nếu muốn tách)
  async updateReport(id: string, dto: Pick<UpdateInspectionDto, 'resultStatus' | 'reportUrl' | 'notes' | 'validUntil'>, userId: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { inspection_id: id },
      select: { inspector_id: true, request_status: true },
    });

    if (!inspection) throw new NotFoundException();
    if (inspection.inspector_id !== userId) {
      throw new ForbiddenException('Bạn không phải inspector được phân công');
    }
    if (inspection.request_status !== 'CONFIRMED') {
      throw new BadRequestException('Chỉ có thể cập nhật báo cáo khi đã xác nhận lịch');
    }

    return this.prisma.inspection.update({
      where: { inspection_id: id },
      data: {
        result_status: dto.resultStatus,
        report_url: dto.reportUrl,
        notes: dto.notes,
        valid_until: dto.validUntil,
        request_status: 'COMPLETED', // tự động chuyển sang hoàn thành khi có báo cáo
      },
    });
  }
  async cancel(id: string, userId: string, userRoleId: number, dto?: CancelInspectionDto) {
  const inspection = await this.prisma.inspection.findUnique({
    where: { inspection_id: id },
    select: { requested_by_id: true, inspector_id: true, request_status: true },
  });
  if (!inspection) throw new NotFoundException();
  
  // Chỉ cho phép hủy nếu đang PENDING hoặc CONFIRMED
  if (!['PENDING', 'CONFIRMED'].includes(inspection.request_status)) {
    throw new BadRequestException('Chỉ có thể hủy yêu cầu đang chờ hoặc đã xác nhận');
  }
  
  // Kiểm tra quyền: requester (nếu PENDING) hoặc inspector (nếu CONFIRMED) hoặc admin
  const isRequester = inspection.requested_by_id === userId;
  const isInspector = inspection.inspector_id === userId;
  const isAdmin = userRoleId === 3;
  
  if (!isRequester && !isInspector && !isAdmin) {
    throw new ForbiddenException();
  }
  if (isRequester && inspection.request_status !== 'PENDING') {
    throw new ForbiddenException('Người yêu cầu chỉ có thể hủy khi đang chờ xác nhận');
  }
  
  return this.prisma.inspection.update({
    where: { inspection_id: id },
    data: {
      request_status: 'CANCELLED',
      notes: dto?.cancelReason ? `Hủy bởi người dùng: ${dto.cancelReason}` : undefined,
    },
  });
}
}