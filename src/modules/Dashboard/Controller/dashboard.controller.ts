import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardService } from '../Service/dashboard.service';
import {
  DashboardSummaryDto,
  ListingStatusDto,
  OrderStatusDto,
  PendingReportDto,
  RevenueChartDto,
  TopListingDto,
  TopSellerDto,
  UserGrowthDto,
} from '../DTOs/dashboard.dto';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_name: string; // 'USER' | 'INSPECTOR' | 'ADMIN' (theo schema)
  };
}

@ApiTags('admin/dashboard')
@ApiBearerAuth('access-token')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(3) // 3 = ADMIN (theo schema Role, role_id bắt đầu từ 1: USER=1, INSPECTOR=2, ADMIN=3)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Thống kê tổng quan', description: 'Trả về các chỉ số chính: số người dùng, bài đăng, đơn hàng, doanh thu, báo cáo chờ...' })
  @ApiResponse({ status: 200, description: 'Thành công', type: DashboardSummaryDto })
  async getSummary(): Promise<DashboardSummaryDto> {
    return this.dashboardService.getSummary();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Doanh thu theo thời gian', description: 'Trả về biểu đồ doanh thu theo ngày/tuần/tháng' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Thành công', type: RevenueChartDto })
  async getRevenueChart(
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<RevenueChartDto> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.dashboardService.getRevenueChart(period, start, end);
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'Tăng trưởng người dùng', description: 'Biểu đồ số lượng người dùng mới đăng ký theo thời gian' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Thành công', type: UserGrowthDto })
  async getUserGrowth(
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
    @Query('limit') limit: number = 30,
  ): Promise<UserGrowthDto> {
    return this.dashboardService.getUserGrowth(period, limit);
  }

  @Get('listing-status')
  @ApiOperation({ summary: 'Phân bố trạng thái bài đăng', description: 'Số lượng bài đăng theo từng trạng thái' })
  @ApiResponse({ status: 200, description: 'Thành công', type: [ListingStatusDto] })
  async getListingStatus(): Promise<ListingStatusDto[]> {
    return this.dashboardService.getListingStatusDistribution();
  }

  @Get('order-status')
  @ApiOperation({ summary: 'Phân bố trạng thái đơn hàng', description: 'Số lượng đơn hàng theo từng trạng thái' })
  @ApiResponse({ status: 200, description: 'Thành công', type: [OrderStatusDto] })
  async getOrderStatus(): Promise<OrderStatusDto[]> {
    return this.dashboardService.getOrderStatusDistribution();
  }

  @Get('top-listings')
  @ApiOperation({ summary: 'Top bài đăng bán chạy', description: 'Danh sách bài đăng có doanh thu cao nhất' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Thành công', type: [TopListingDto] })
  async getTopListings(@Query('limit') limit: number = 10): Promise<TopListingDto[]> {
    return this.dashboardService.getTopListings(limit);
  }

  @Get('top-sellers')
  @ApiOperation({ summary: 'Top người bán', description: 'Danh sách người bán có doanh thu cao nhất' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Thành công', type: [TopSellerDto] })
  async getTopSellers(@Query('limit') limit: number = 10): Promise<TopSellerDto[]> {
    return this.dashboardService.getTopSellers(limit);
  }

  @Get('pending-reports')
  @ApiOperation({ summary: 'Báo cáo chờ xử lý', description: 'Danh sách các báo cáo có trạng thái PENDING' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Thành công', type: [PendingReportDto] })
  async getPendingReports(@Query('limit') limit: number = 20): Promise<PendingReportDto[]> {
    return this.dashboardService.getPendingReports(limit);
  }
}