import { ApiProperty } from '@nestjs/swagger';

// ========== SUMMARY ==========
export class DashboardSummaryDto {
  @ApiProperty({ description: 'Tổng số người dùng' })
  totalUsers: number;

  @ApiProperty({ description: 'Người dùng mới trong 7 ngày qua' })
  newUsersThisWeek: number;

  @ApiProperty({ description: 'Tỷ lệ tăng người dùng (%) so với tuần trước' })
  userGrowthPercent: number;

  @ApiProperty({ description: 'Tổng số bài đăng' })
  totalListings: number;

  @ApiProperty({ description: 'Bài đăng đang chờ duyệt' })
  pendingListings: number;

  @ApiProperty({ description: 'Bài đăng đã bán' })
  soldListings: number;

  @ApiProperty({ description: 'Bài đăng hết hạn' })
  expiredListings: number;

  @ApiProperty({ description: 'Tổng số đơn hàng' })
  totalOrders: number;

  @ApiProperty({ description: 'Đơn hàng mới trong tháng' })
  ordersThisMonth: number;

  @ApiProperty({ description: 'Đơn hàng đã hoàn thành' })
  completedOrders: number;

  @ApiProperty({ description: 'Đơn hàng đã hủy' })
  cancelledOrders: number;

  @ApiProperty({ description: 'Tổng doanh thu (VNĐ)' })
  totalRevenue: number;

  @ApiProperty({ description: 'Doanh thu tháng này (VNĐ)' })
  revenueThisMonth: number;

  @ApiProperty({ description: 'Tỷ lệ tăng doanh thu (%) so với tháng trước' })
  revenueGrowthPercent: number;

  @ApiProperty({ description: 'Báo cáo chờ xử lý' })
  pendingReports: number;

  @ApiProperty({ description: 'Đánh giá trung bình hệ thống' })
  avgRating: number;

  @ApiProperty({ description: 'Số lượng đánh giá' })
  totalReviews: number;
}

// ========== REVENUE CHART ==========
export class RevenueChartDto {
  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [Number] })
  data: number[];

  @ApiProperty({ description: 'Tổng doanh thu trong khoảng thời gian' })
  total: number;

  @ApiProperty({ description: 'Doanh thu trung bình mỗi kỳ' })
  average: number;

  @ApiProperty({ description: 'Ngày có doanh thu cao nhất' })
  peakDay: string;

  @ApiProperty({ description: 'Doanh thu cao nhất' })
  peakRevenue: number;
}

// ========== USER GROWTH ==========
export class UserGrowthDto {
  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [Number] })
  data: number[];

  @ApiProperty({ description: 'Tổng người dùng mới trong kỳ' })
  total: number;

  @ApiProperty({ description: 'Tăng trưởng trung bình mỗi kỳ' })
  average: number;
}

// ========== LISTING STATUS ==========
export class ListingStatusDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ description: 'Phần trăm (%)' })
  percentage: number;
}

// ========== ORDER STATUS ==========
export class OrderStatusDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percentage: number;
}

// ========== TOP LISTINGS ==========
export class TopListingDto {
  @ApiProperty()
  listingId: string;

  @ApiProperty({ description: 'Tên sản phẩm (xe)' })
  title: string;

  @ApiProperty({ description: 'Ảnh đại diện' })
  thumbnailUrl: string | null;

  @ApiProperty({ description: 'Người bán' })
  sellerName: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty({ description: 'Giá niêm yết' })
  price: number;

  @ApiProperty({ description: 'Trạng thái listing' })
  status: string;

  @ApiProperty({ description: 'Số lượng đã bán' })
  totalSold: number;

  @ApiProperty({ description: 'Doanh thu từ listing' })
  revenue: number;

  @ApiProperty({ description: 'Ngày đăng' })
  createdAt: Date;

  @ApiProperty({ description: 'Danh mục xe' })
  category: string;

  @ApiProperty({ description: 'Số lượt xem' })
  viewCount: number;

  @ApiProperty({ description: 'Số lượt thích (wishlist)' })
  wishlistCount: number;
}

// ========== TOP SELLERS ==========
export class TopSellerDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  avatarUrl: string | null;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Số điện thoại' })
  phone: string;

  @ApiProperty({ description: 'Ngày tham gia' })
  joinedAt: Date;

  @ApiProperty({ description: 'Tổng doanh thu' })
  totalRevenue: number;

  @ApiProperty({ description: 'Số lượng bài đăng đã bán' })
  totalListingsSold: number;

  @ApiProperty({ description: 'Tổng số đơn hàng đã hoàn thành' })
  totalOrders: number;

  @ApiProperty({ description: 'Đánh giá trung bình' })
  avgRating: number;

  @ApiProperty({ description: 'Số lượng đánh giá' })
  totalReviews: number;

  @ApiProperty({ description: 'Số lượng bài đăng đang hoạt động' })
  activeListings: number;
}

// ========== PENDING REPORTS ==========
export class PendingReportDto {
  @ApiProperty()
  reportId: string;

  @ApiProperty({ description: 'Người báo cáo' })
  reporterName: string;

  @ApiProperty()
  reporterId: string;

  @ApiProperty({ description: 'Bài đăng bị báo cáo' })
  listingId: string;

  @ApiProperty()
  listingTitle: string;

  @ApiProperty()
  listingThumbnail: string | null;

  @ApiProperty({ description: 'Người đăng bài' })
  listingOwnerName: string;

  @ApiProperty({ description: 'Lý do báo cáo' })
  reason: string;

  @ApiProperty({ description: 'Mô tả chi tiết' })
  description: string | null;

  @ApiProperty({ description: 'Ngày báo cáo' })
  createdAt: Date;
}