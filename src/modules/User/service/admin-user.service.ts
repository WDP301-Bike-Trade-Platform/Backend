import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { Prisma, NotificationType } from '@prisma/client';
import { AdminUserQueryDto, UpdateUserStatusDto, UserStatusFilter } from '../dto/admin-user.dto';

@Injectable()
export class AdminUserService {
  constructor(private prisma: PrismaService) {}

  // ---------- Danh sách người dùng + filter ----------
  async findAll(query: AdminUserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const { role, status, fromDate, toDate, search } = query;

    const where: Prisma.UserWhereInput = {};
    const now = new Date();

    // 1. Lọc theo role
    if (role) {
      where.role = { role_name: role };
    }

    // 2. Lọc theo trạng thái locked
    if (status && status !== UserStatusFilter.ALL) {
      if (status === UserStatusFilter.ACTIVE) {
        where.OR = [
          { locked_until: null },
          { locked_until: { lt: now } },
        ] as Prisma.UserWhereInput[]; // Ép kiểu
      } else if (status === UserStatusFilter.LOCKED) {
        where.locked_until = { gt: now };
      }
    }

    // 3. Lọc theo ngày tham gia
    if (fromDate || toDate) {
      where.created_at = {};
      if (fromDate) where.created_at.gte = new Date(fromDate);
      if (toDate) where.created_at.lte = new Date(toDate);
    }

    // 4. Tìm kiếm theo tên, email, phone
    if (search) {
      const searchConditions: Prisma.UserWhereInput[] = [
        { full_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];

      if (where.OR) {
        // Nếu đã có OR (từ status), kết hợp thêm
        const existingOr = Array.isArray(where.OR) ? where.OR : [where.OR];
        where.OR = [...existingOr, ...searchConditions] as Prisma.UserWhereInput[];
      } else {
        where.OR = searchConditions;
      }
    }

    // 5. Thực hiện truy vấn
    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          user_id: true,
          full_name: true,
          email: true,
          phone: true,
          role: { select: { role_name: true } },
          created_at: true,
          locked_until: true,
          violation_count: true,
          is_verified: true,
          _count: {
            select: {
              listings: true,
              orders: true,
              reports: true,
            },
          },
        },
      }),
    ]);

    // 6. Thêm trường status tính toán
    const data = users.map(user => ({
      ...user,
      status: user.locked_until && user.locked_until > now ? 'locked' : 'active',
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------- Chi tiết người dùng ----------
  async findOne(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        profile: true,
        addresses: true,
        role: true,
      },
    });
    if (!user) throw new NotFoundException('User không tồn tại');
    return user;
  }

  // ---------- Chi tiết hoạt động của user ----------
  async getUserActivity(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        listings: {
          take: 5,
          orderBy: { created_at: 'desc' },
          include: { vehicle: true, media: { take: 1 } },
        },
        orders: {
          take: 5,
          orderBy: { created_at: 'desc' },
          include: { listing: { include: { vehicle: true } } },
        },
        reviewsGiven: {
          take: 5,
          orderBy: { created_at: 'desc' },
          include: { listing: { include: { vehicle: true } } },
        },
        reports: {
          take: 5,
          orderBy: { created_at: 'desc' },
          include: { listing: { include: { vehicle: true } } },
        },
        inspectionsRequested: {
          take: 5,
          orderBy: { created_at: 'desc' },
          include: { listing: { include: { vehicle: true } } },
        },
        inspectionsAssigned: {
          take: 5,
          orderBy: { created_at: 'desc' },
          include: { listing: { include: { vehicle: true } } },
        },
        messagesSent: {
          take: 5,
          orderBy: { created_at: 'desc' },
        },
        _count: {
          select: {
            listings: true,
            orders: true,
            reviewsGiven: true,
            reports: true,
            inspectionsRequested: true,
            inspectionsAssigned: true,
            messagesSent: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User không tồn tại');

    // Loại bỏ password nếu có (prisma không select password nhưng an toàn)
    const { password, ...userInfo } = user as any;
    return {
      user: userInfo,
      counts: user._count,
      recentListings: user.listings,
      recentOrders: user.orders,
      recentReviews: user.reviewsGiven,
      recentReports: user.reports,
      recentInspectionsRequested: user.inspectionsRequested,
      recentInspectionsAssigned: user.inspectionsAssigned,
      recentMessages: user.messagesSent,
    };
  }

  // ---------- Cập nhật trạng thái khóa/mở khóa + gửi thông báo ----------
  async updateStatus(userId: string, dto: UpdateUserStatusDto, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      select: { user_id: true, email: true, full_name: true, locked_until: true },
    });
    if (!user) throw new NotFoundException('User không tồn tại');

    const now = new Date();
    let lockedUntil: Date | null = null;
    if (dto.lockedUntil) {
      const date = new Date(dto.lockedUntil);
      if (isNaN(date.getTime())) throw new BadRequestException('Thời gian khóa không hợp lệ');
      lockedUntil = date > now ? date : null;
    }

    const updatedUser = await this.prisma.user.update({
      where: { user_id: userId },
      data: { locked_until: lockedUntil },
    });

    const action = lockedUntil ? 'locked' : 'unlocked';
    const title = `Tài khoản của bạn đã được ${action === 'locked' ? 'khóa' : 'mở khóa'}`;
    const message = dto.reason || (action === 'locked' 
      ? 'Tài khoản của bạn đã bị khóa do vi phạm quy định.' 
      : 'Tài khoản của bạn đã được mở khóa.');

    await this.prisma.notification.create({
      data: {
        user_id: userId,
        type: NotificationType.SYSTEM,
        title,
        message,
        link: null,
        is_read: false,
        created_at: now,
      },
    });

    // Gửi email nếu có service
    // await this.emailService.send({ to: user.email, subject: title, text: message });

    return updatedUser;
  }
}