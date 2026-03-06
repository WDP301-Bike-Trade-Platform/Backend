import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { ReportStatus, ReportResolution } from '@prisma/client';
import { CreateReportDto, ReportQueryDto, UpdateReportDto } from '../DTOs/report.dto';

@Injectable()
export class ReportService {
  constructor(private prisma: PrismaService) {}

  // ---------- Người dùng ----------
  async create(userId: string, dto: CreateReportDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { listing_id: dto.listingId },
      select: { listing_id: true },
    });
    if (!listing) throw new NotFoundException('Listing không tồn tại');

    return this.prisma.report.create({
      data: {
        user_id: userId,
        listing_id: dto.listingId,
        reason: dto.reason,
        description: dto.description,
        status: ReportStatus.PENDING,
      },
      include: {
        listing: { include: { vehicle: true } },
      },
    });
  }

  async cancel(reportId: string, userId: string) {
    const report = await this.prisma.report.findUnique({
      where: { report_id: reportId },
      select: { user_id: true, status: true },
    });
    if (!report) throw new NotFoundException('Báo cáo không tồn tại');
    if (report.user_id !== userId)
      throw new ForbiddenException('Không thể hủy báo cáo của người khác');
    if (report.status !== ReportStatus.PENDING)
      throw new BadRequestException('Chỉ có thể hủy báo cáo đang chờ xử lý');

    return this.prisma.report.update({
      where: { report_id: reportId },
      data: { status: ReportStatus.CANCELLED },
    });
  }

  // ---------- Admin ----------
  async findAllForAdmin(query: ReportQueryDto) {
    const { status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [total, items] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { user_id: true, full_name: true, email: true } },
          listing: {
            include: {
              seller: { select: { user_id: true, full_name: true } },
              vehicle: true,
            },
          },
          admin: { select: { user_id: true, full_name: true } },
        },
      }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { report_id: reportId },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        listing: {
          include: {
            seller: { select: { user_id: true, full_name: true, email: true } },
            vehicle: true,
          },
        },
        admin: { select: { user_id: true, full_name: true } },
      },
    });
    if (!report) throw new NotFoundException('Báo cáo không tồn tại');
    return report;
  }

  async process(reportId: string, dto: UpdateReportDto, adminId: string) {
    const report = await this.prisma.report.findUnique({
      where: { report_id: reportId },
      select: { status: true },
    });
    if (!report) throw new NotFoundException();

    // Sửa lỗi TypeScript: ép kiểu mảng về ReportStatus[]
    const 終了Statuses: ReportStatus[] = [ReportStatus.RESOLVED, ReportStatus.REJECTED, ReportStatus.CANCELLED];
    if (終了Statuses.includes(report.status)) {
      throw new BadRequestException('Báo cáo đã kết thúc, không thể xử lý thêm');
    }

    const data: any = { ...dto };
    if (dto.status === ReportStatus.RESOLVED || dto.status === ReportStatus.REJECTED) {
      data.processed_by = adminId;
      data.processed_at = new Date();
    }

    return this.prisma.report.update({
      where: { report_id: reportId },
      data,
      include: { admin: true },
    });
  }
}