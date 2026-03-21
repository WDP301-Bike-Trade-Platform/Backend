import { Injectable } from '@nestjs/common';
import {
  DashboardSummaryDto,
  RevenueChartDto,
  UserGrowthDto,
  ListingStatusDto,
  OrderStatusDto,
  TopListingDto,
  TopSellerDto,
  PendingReportDto,
} from '../DTOs/dashboard.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfWeek.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      newUsersThisWeek,
      newUsersLastWeek,
      totalListings,
      pendingListings,
      soldListings,
      expiredListings,
      totalOrders,
      ordersThisMonth,
      completedOrders,
      cancelledOrders,
      totalRevenueAgg,
      revenueThisMonthAgg,
      revenueLastMonthAgg,
      pendingReports,
      avgRatingAgg,
      totalReviews,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { created_at: { gte: startOfWeek } } }),
      this.prisma.user.count({ where: { created_at: { gte: startOfLastWeek, lt: startOfWeek } } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'PENDING_APPROVAL' } }),
      this.prisma.listing.count({ where: { status: 'SOLD' } }),
      this.prisma.listing.count({ where: { status: 'EXPIRED' } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { created_at: { gte: startOfMonth } } }),
      this.prisma.order.count({ where: { status: 'COMPLETED' } }),
      this.prisma.order.count({ where: { status: { in: ['CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'FORFEITED'] } } }),
      this.prisma.orderDetail.aggregate({
        where: { order: { status: { in: ['COMPLETED', 'PAID'] } } },
        _sum: { total_price: true },
      }),
      this.prisma.orderDetail.aggregate({
        where: {
          order: {
            status: { in: ['COMPLETED', 'PAID'] },
            created_at: { gte: startOfMonth },
          },
        },
        _sum: { total_price: true },
      }),
      this.prisma.orderDetail.aggregate({
        where: {
          order: {
            status: { in: ['COMPLETED', 'PAID'] },
            created_at: { gte: startOfLastMonth, lt: startOfMonth },
          },
        },
        _sum: { total_price: true },
      }),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.review.aggregate({ _avg: { rating: true } }),
      this.prisma.review.count(),
    ]);

    const totalRevenue = totalRevenueAgg._sum.total_price?.toNumber() || 0;
    const revenueThisMonth = revenueThisMonthAgg._sum.total_price?.toNumber() || 0;
    const revenueLastMonth = revenueLastMonthAgg._sum.total_price?.toNumber() || 0;

    const userGrowthPercent = newUsersLastWeek === 0
      ? (newUsersThisWeek > 0 ? 100 : 0)
      : ((newUsersThisWeek - newUsersLastWeek) / newUsersLastWeek) * 100;

    const revenueGrowthPercent = revenueLastMonth === 0
      ? (revenueThisMonth > 0 ? 100 : 0)
      : ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100;

    return {
      totalUsers,
      newUsersThisWeek,
      userGrowthPercent,
      totalListings,
      pendingListings,
      soldListings,
      expiredListings,
      totalOrders,
      ordersThisMonth,
      completedOrders,
      cancelledOrders,
      totalRevenue,
      revenueThisMonth,
      revenueGrowthPercent,
      pendingReports,
      avgRating: avgRatingAgg._avg.rating || 0,
      totalReviews,
    };
  }

  async getRevenueChart(
    period: 'day' | 'week' | 'month' = 'day',
    startDate?: Date,
    endDate?: Date,
  ): Promise<RevenueChartDto> {
    const now = new Date();
    let start = startDate;
    let end = endDate;

    if (!start) {
      switch (period) {
        case 'day':
          start = new Date(now);
          start.setDate(now.getDate() - 30);
          break;
        case 'week':
          start = new Date(now);
          start.setDate(now.getDate() - 12 * 7);
          break;
        case 'month':
          start = new Date(now);
          start.setMonth(now.getMonth() - 12);
          break;
      }
      start.setHours(0, 0, 0, 0);
    }
    if (!end) {
      end = now;
      end.setHours(23, 59, 59, 999);
    }

    const groupBySql = `
      SELECT DATE(o.created_at) as date, SUM(od.total_price) as revenue
      FROM orders o
      JOIN order_details od ON o.order_id = od.order_id
      WHERE o.status IN ('COMPLETED', 'PAID')
        AND o.created_at >= $1
        AND o.created_at <= $2
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `;

    const results: any[] = await this.prisma.$queryRawUnsafe(
      groupBySql,
      start,
      end,
    );

    const labels = results.map((row) => row.date.toISOString().split('T')[0]);
    const data = results.map((row) => parseFloat(row.revenue));
    const total = data.reduce((acc, val) => acc + val, 0);
    const average = data.length ? total / data.length : 0;
    const maxRevenue = Math.max(...data, 0);
    const peakIndex = data.indexOf(maxRevenue);
    const peakDay = peakIndex !== -1 ? labels[peakIndex] : '';

    return { labels, data, total, average, peakDay, peakRevenue: maxRevenue };
  }

  async getUserGrowth(
    period: 'day' | 'week' | 'month' = 'day',
    limit: number = 30,
  ): Promise<UserGrowthDto> {
    let dateTrunc: string;
    switch (period) {
      case 'day':
        dateTrunc = 'day';
        break;
      case 'week':
        dateTrunc = 'week';
        break;
      case 'month':
        dateTrunc = 'month';
        break;
      default:
        dateTrunc = 'day';
    }

    const sql = `
      SELECT DATE_TRUNC('${dateTrunc}', created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= NOW() - INTERVAL '${limit} ${period}s'
      GROUP BY date
      ORDER BY date ASC
    `;

    const results: any[] = await this.prisma.$queryRawUnsafe(sql);
    const labels = results.map((row) => row.date.toISOString().split('T')[0]);
    const data = results.map((row) => parseInt(row.count));
    const total = data.reduce((a, b) => a + b, 0);
    const average = data.length ? total / data.length : 0;

    return { labels, data, total, average };
  }

  async getListingStatusDistribution(): Promise<ListingStatusDto[]> {
    const groups = await this.prisma.listing.groupBy({
      by: ['status'],
      _count: true,
    });

    const total = groups.reduce((sum, g) => sum + g._count, 0);

    return groups.map((g) => ({
      status: g.status,
      count: g._count,
      percentage: total > 0 ? (g._count / total) * 100 : 0,
    }));
  }

  async getOrderStatusDistribution(): Promise<OrderStatusDto[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      _count: true,
    });

    const total = groups.reduce((sum, g) => sum + g._count, 0);

    return groups.map((g) => ({
      status: g.status,
      count: g._count,
      percentage: total > 0 ? (g._count / total) * 100 : 0,
    }));
  }

  async getTopListings(limit: number = 10): Promise<TopListingDto[]> {
    const topListings = await this.prisma.orderDetail.groupBy({
      by: ['listing_id'],
      _sum: {
        quantity: true,
        total_price: true,
      },
      orderBy: {
        _sum: {
          total_price: 'desc',
        },
      },
      take: limit,
    });

    const listingIds = topListings.map((item) => item.listing_id);
    const listings = await this.prisma.listing.findMany({
      where: { listing_id: { in: listingIds } },
      include: {
        seller: { select: { user_id: true, full_name: true } },
        vehicle: { include: { category: true } },
        media: {
          where: { is_cover: true },
          take: 1,
          select: { file_url: true },
        },
        _count: {
          select: {
            interactions: { where: { type: 'VIEW' } },
            wishlistItems: true,
          },
        },
      },
    });

    const listingMap = new Map(listings.map((l) => [l.listing_id, l]));

    return topListings.map((item) => {
      const listing = listingMap.get(item.listing_id);
      const vehicle = listing?.vehicle;
      return {
        listingId: item.listing_id,
        title: vehicle ? `${vehicle.brand} ${vehicle.model}` : 'N/A',
        thumbnailUrl: listing?.media[0]?.file_url || null,
        sellerName: listing?.seller.full_name || 'N/A',
        sellerId: listing?.seller.user_id || '',
        price: vehicle?.price?.toNumber() || 0,
        status: listing?.status || 'UNKNOWN',
        totalSold: item._sum.quantity || 0,
        revenue: item._sum.total_price?.toNumber() || 0,
        createdAt: listing?.created_at || new Date(),
        category: vehicle?.category?.name || '',
        viewCount: listing?._count?.interactions || 0,
        wishlistCount: listing?._count?.wishlistItems || 0,
      };
    });
  }

  async getTopSellers(limit: number = 10): Promise<TopSellerDto[]> {
    const topSellers = await this.prisma.$queryRaw<any[]>`
      SELECT 
        u.user_id, 
        u.full_name,
        u.email,
        u.phone,
        u.created_at as joined_at,
        up.avatar_url,
        COALESCE(SUM(od.total_price), 0) as total_revenue,
        COUNT(DISTINCT l.listing_id) as total_listings_sold,
        COUNT(DISTINCT o.order_id) as total_orders,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT r.review_id) as total_reviews,
        COUNT(DISTINCT CASE WHEN l.status = 'ACTIVE' THEN l.listing_id END) as active_listings
      FROM users u
      LEFT JOIN user_profiles up ON u.user_id = up.user_id
      LEFT JOIN listings l ON u.user_id = l.seller_id
      LEFT JOIN order_details od ON l.listing_id = od.listing_id
      LEFT JOIN orders o ON od.order_id = o.order_id AND o.status IN ('COMPLETED', 'PAID')
      LEFT JOIN reviews r ON r.seller_id = u.user_id
      GROUP BY u.user_id, u.full_name, u.email, u.phone, u.created_at, up.avatar_url
      ORDER BY total_revenue DESC
      LIMIT ${limit}
    `;

    return topSellers.map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      avatarUrl: row.avatar_url || null,
      email: row.email,
      phone: row.phone,
      joinedAt: row.joined_at,
      totalRevenue: parseFloat(row.total_revenue),
      totalListingsSold: parseInt(row.total_listings_sold),
      totalOrders: parseInt(row.total_orders),
      avgRating: parseFloat(row.avg_rating),
      totalReviews: parseInt(row.total_reviews),
      activeListings: parseInt(row.active_listings),
    }));
  }

  async getPendingReports(limit: number = 20): Promise<PendingReportDto[]> {
    const reports = await this.prisma.report.findMany({
      where: { status: 'PENDING' },
      include: {
        user: { select: { user_id: true, full_name: true } },
        listing: {
          include: {
            seller: { select: { full_name: true } },
            vehicle: true,
            media: {
              where: { is_cover: true },
              take: 1,
              select: { file_url: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    return reports.map((report) => ({
      reportId: report.report_id,
      reporterName: report.user.full_name,
      reporterId: report.user.user_id,
      listingId: report.listing_id,
      listingTitle: report.listing
        ? `${report.listing.vehicle.brand} ${report.listing.vehicle.model}`
        : 'N/A',
      listingThumbnail: report.listing?.media[0]?.file_url || null,
      listingOwnerName: report.listing?.seller.full_name || 'N/A',
      reason: report.reason,
      description: report.description,
      createdAt: report.created_at,
    }));
  }
}