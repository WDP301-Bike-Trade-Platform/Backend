import { Controller, Post, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { InspectionService } from '../Service/inspection.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  CancelInspectionDto,
  CreateInspectionDto,
  InspectionQueryDto,
  UpdateInspectionDto,
  UpdateReportDto,
} from '../DTOs/inspection.dto';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_id: number; // 1: USER, 2: INSPECTOR, 3: ADMIN
  };
}

@ApiTags('Inspections')
@ApiBearerAuth('access-token')
@Controller('inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  /**
   * ==================== USER ENDPOINTS ====================
   * Các endpoint dành riêng cho User (role_id = 1)
   */

  @Post()
  @Roles(1)
  @ApiOperation({ 
    summary: '[USER] Tạo yêu cầu kiểm định mới',
    description: `
      - Chỉ USER mới có quyền tạo yêu cầu kiểm định
      - Yêu cầu: Listing phải ở trạng thái ACTIVE hoặc APPROVED
      - Kết quả: Tạo inspection với status = PENDING, chờ inspector nhận
      - Hệ thống tự động gán requested_by_id = user hiện tại
    `
  })
  @ApiResponse({ status: 201, description: 'Tạo yêu cầu thành công' })
  @ApiResponse({ status: 400, description: 'Listing không khả dụng' })
  @ApiResponse({ status: 404, description: 'Listing không tồn tại' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateInspectionDto) {
    return this.inspectionService.create(req.user.user_id, dto);
  }

  @Get('my-requests')
  @Roles(1)
  @ApiOperation({ 
    summary: '[USER] Lấy danh sách yêu cầu do chính user tạo',
    description: `
      - Chỉ USER mới xem được danh sách này
      - Kết quả trả về là các inspection mà user hiện tại là người yêu cầu
      - Hỗ trợ phân trang và lọc theo listingId, requestStatus
    `
  })
  @ApiResponse({ status: 200, description: 'Danh sách yêu cầu của user' })
  async findMyRequests(@Req() req: RequestWithUser, @Query() query: InspectionQueryDto) {
    return this.inspectionService.findMyRequests(req.user.user_id, query);
  }

  /**
   * ==================== INSPECTOR ENDPOINTS ====================
   * Các endpoint dành riêng cho Inspector (role_id = 2)
   */

  @Post(':id/assign')
  @Roles(2)
  @ApiOperation({ 
    summary: '[INSPECTOR] Tự nhận một inspection đang chờ',
    description: `
      - Chỉ INSPECTOR mới được nhận inspection
      - Điều kiện nhận: inspection đang PENDING và chưa có inspector (inspector_id = null)
      - Kết quả: 
        * inspector_id = user hiện tại
        * request_status chuyển từ PENDING → CONFIRMED
        * Gửi notification cho người yêu cầu
      - Nếu inspection đã có inspector hoặc không ở PENDING → báo lỗi
    `
  })
  @ApiResponse({ status: 200, description: 'Nhận inspection thành công' })
  @ApiResponse({ status: 400, description: 'Inspection không khả dụng để nhận' })
  async assignToSelf(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.inspectionService.assignToSelf(id, req.user.user_id);
  }

  @Patch(':id/report')
  @Roles(2)
  @ApiOperation({ 
    summary: '[INSPECTOR] Cập nhật báo cáo kiểm định (hoàn tất)',
    description: `
      - Chỉ INSPECTOR được phân công mới có quyền cập nhật báo cáo
      - Điều kiện: inspection đang ở trạng thái CONFIRMED
      - Kết quả:
        * Cập nhật result_status (PASSED/FAILED)
        * Cập nhật report_url, notes, valid_until
        * request_status chuyển từ CONFIRMED → COMPLETED
    `
  })
  @ApiResponse({ status: 200, description: 'Cập nhật báo cáo thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền hoặc sai trạng thái' })
  async updateReport(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.updateReport(id, dto, req.user.user_id);
  }

  /**
   * ==================== SHARED ENDPOINTS ====================
   * Các endpoint dùng chung cho nhiều role (phân quyền trong service)
   */

  @Patch(':id/cancel')
  @Roles(1, 2, 3)
  @ApiOperation({ 
    summary: '[ALL] Hủy yêu cầu kiểm định (phân quyền theo role)',
    description: `
      **USER (role_id = 1):**
      - Chỉ hủy được inspection do chính mình tạo
      - Chỉ hủy khi đang ở trạng thái PENDING
      - Kết quả: request_status → CANCELLED (hủy hẳn)
      
      **INSPECTOR (role_id = 2):**
      - Chỉ hủy được inspection mình đã nhận
      - Được hủy khi đang ở PENDING hoặc CONFIRMED
      - Kết quả: 
        * request_status → PENDING (trả về trạng thái chờ)
        * inspector_id → null (xóa người nhận)
        * Cho phép inspector khác nhận lại
      
      **ADMIN (role_id = 3):**
      - Hủy được bất kỳ inspection nào đang PENDING hoặc CONFIRMED
      - Kết quả: request_status → CANCELLED (hủy hẳn)
      
      Tất cả các trường hợp đều ghi nhận lý do hủy (nếu có) và gửi notification cho các bên liên quan.
    `
  })
  @ApiResponse({ status: 200, description: 'Hủy thành công' })
  @ApiResponse({ status: 400, description: 'Không thể hủy (sai trạng thái/quyền)' })
  @ApiResponse({ status: 403, description: 'Không có quyền hủy' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelInspectionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.cancel(id, req.user.user_id, req.user.role_id, dto);
  }

  @Get()
  @Roles(1, 2, 3)
  @ApiOperation({ 
    summary: '[ALL] Lấy danh sách inspections (phân quyền theo role)',
    description: `
      **USER (role_id = 1):**
      - Chỉ xem được inspections do mình tạo (requested_by_id = user_id)
      
      **INSPECTOR (role_id = 2):**
      - Xem được:
        * Các inspection mình đã nhận (inspector_id = user_id)
        * Các inspection đang PENDING và chưa có inspector (để nhận)
      
      **ADMIN (role_id = 3):**
      - Xem được tất cả inspections không filter
      
      Hỗ trợ phân trang và lọc theo listingId, requestStatus.
    `
  })
  @ApiResponse({ status: 200, description: 'Danh sách inspections' })
  async findAll(@Req() req: RequestWithUser, @Query() query: InspectionQueryDto) {
    return this.inspectionService.findAll(req.user.user_id, req.user.role_id, query);
  }

  @Get(':id')
  @Roles(1, 2, 3)
  @ApiOperation({ 
    summary: '[ALL] Lấy chi tiết một inspection (phân quyền theo role)',
    description: `
      Quyền xem chi tiết:
      - **USER:** Chỉ xem được inspection do mình tạo
      - **INSPECTOR:** 
        * Xem được inspection mình đã nhận
        * Xem được inspection đang PENDING và chưa có inspector (để xem trước khi nhận)
      - **ADMIN:** Xem được tất cả
      
      Kết quả trả về bao gồm thông tin listing, vehicle, requester, inspector.
    `
  })
  @ApiResponse({ status: 200, description: 'Chi tiết inspection' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy inspection' })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.inspectionService.findOne(id, req.user.user_id, req.user.role_id);
  }

  /**
   * ==================== ADMIN/INSPECTOR ENDPOINTS ====================
   * Các endpoint dành cho Admin và Inspector
   */

  @Patch(':id')
  @Roles(2, 3)
  @ApiOperation({ 
    summary: '[INSPECTOR/ADMIN] Cập nhật thông tin inspection',
    description: `
      - **INSPECTOR:** Chỉ cập nhật được inspection mình đã nhận
      - **ADMIN:** Cập nhật được tất cả inspections
      - Không thể cập nhật khi inspection đã COMPLETED hoặc CANCELLED
      - Chỉ cập nhật các trường cho phép (scheduled_at, notes,...)
    `
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Không thể cập nhật (sai trạng thái)' })
  @ApiResponse({ status: 403, description: 'Không có quyền cập nhật' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.update(id, dto, req.user.user_id, req.user.role_id);
  }
}