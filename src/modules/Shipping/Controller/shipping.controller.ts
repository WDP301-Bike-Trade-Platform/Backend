// shipping.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ShippingDemoService } from '../Service/shipping.service';
import { CreateShipmentDto, ManualUpdateStatusDto, ShipmentQueryDto, ShipmentResponseDto } from '../DTOs/shipping.dto';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_name: string; // 'USER' | 'INSPECTOR' | 'ADMIN' (theo schema)
  };
}

@ApiTags('Shipping')
@ApiBearerAuth('access-token')
@Controller('shipping')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShippingController {
  constructor(private readonly shippingService: ShippingDemoService) {}

  /**
   * ==================== USER ENDPOINTS ====================
   * Dành cho người mua (USER) xem thông tin vận chuyển của đơn hàng mình đã mua.
   */
  @Get('order/:orderId')
  @Roles(1,3)
  @ApiOperation({ 
    summary: '[USER,Admin] Lấy thông tin vận chuyển của một đơn hàng',
    description: `
      - **USER:** chỉ xem được shipment của đơn hàng do mình mua (kiểm tra trong service)
      - **ADMIN:** xem được bất kỳ shipment nào
      - Kết quả trả về chi tiết shipment kèm danh sách tracking.
    `
  })
  @ApiResponse({ status: 200, description: 'Thông tin shipment', type: ShipmentResponseDto })
  @ApiResponse({ status: 403, description: 'Không có quyền xem' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy shipment' })
  async getShipmentByOrder(
    @Param('orderId') orderId: string,
    @Req() req: RequestWithUser,
  ): Promise<ShipmentResponseDto> {
    return this.shippingService.getShipmentByOrder(orderId, req.user.user_id, req.user.role_name);
  }
  @Get('my-shipments')
    @Roles(1)
    @ApiOperation({ 
    summary: '[USER] Lấy danh sách vận chuyển của tôi',
    description: `
        - **USER:** lấy tất cả shipments liên quan đến user (vai trò buyer hoặc seller)
        - Hỗ trợ phân trang (skip, take) và lọc theo status
    `
    })
    @ApiResponse({ status: 200, description: 'Danh sách shipments' })
    async getMyShipments(
    @Req() req: RequestWithUser,
    @Query() query: ShipmentQueryDto,
    ) {
    return this.shippingService.getMyShipments(
        req.user.user_id,
        req.user.role_name,
        query,
    );
    }
  /**
   * ==================== SELLER ENDPOINTS ====================
   * Dành cho người bán (USER) xác nhận chuẩn bị hàng, cập nhật trạng thái thủ công.
   * (Vì role_name = USER cho cả buyer và seller, nên quyền seller được kiểm tra trong service)
   */
  @Patch(':shipmentId/confirm-ready')
  @Roles(1,3)
  @ApiOperation({ 
    summary: '[SELLER] Xác nhận đã chuẩn bị hàng xong',
    description: `
      - **USER (người bán):** chỉ xác nhận được shipment của đơn hàng do mình bán
      - **ADMIN:** xác nhận được bất kỳ shipment nào
      - Cập nhật \`shop_confirmed_at\` = thời điểm hiện tại
    `
  })
  @ApiResponse({ status: 200, description: 'Xác nhận thành công', type: ShipmentResponseDto })
  @ApiResponse({ status: 403, description: 'Không có quyền xác nhận' })
  async confirmShipmentReady(
    @Param('shipmentId') shipmentId: string,
    @Req() req: RequestWithUser,
  ): Promise<ShipmentResponseDto> {
    return this.shippingService.confirmShipmentReady(shipmentId, req.user.user_id, req.user.role_name);
  }

  @Patch(':shipmentId/status')
  @Roles(1,3)
  @ApiOperation({ 
    summary: '[SELLER/ADMIN] Cập nhật thủ công trạng thái vận chuyển',
    description: `
      - **USER (người bán):** chỉ cập nhật được shipment của đơn hàng do mình bán
      - **ADMIN:** cập nhật được bất kỳ shipment nào
      - Cập nhật \`status\`, \`location\`, \`description\`, và các mốc thời gian tương ứng.
    `
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công', type: ShipmentResponseDto })
  @ApiResponse({ status: 400, description: 'Trạng thái không hợp lệ' })
  @ApiResponse({ status: 403, description: 'Không có quyền cập nhật' })
  async manualUpdate(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ManualUpdateStatusDto,
    @Req() req: RequestWithUser,
  ): Promise<ShipmentResponseDto> {
    return this.shippingService.updateStatusManually(shipmentId, dto, req.user.user_id, req.user.role_name);
  }

  /**
   * ==================== ADMIN ENDPOINTS ====================
   * Dành riêng cho ADMIN: tạo shipment từ order (thủ công), xem tất cả shipments, v.v.
   */
  @Post('create-from-order')
  @Roles(3)
  @ApiOperation({ 
    summary: '[ADMIN] Tạo shipment từ một đơn hàng (thủ công)',
    description: `
      - Chỉ **ADMIN** mới có quyền tạo shipment thủ công.
      - Thường dùng khi thanh toán thành công nhưng hệ thống chưa tự động tạo.
      - Kiểm tra order đã thanh toán và chưa có shipment.
    `
  })
  @ApiResponse({ status: 201, description: 'Tạo shipment thành công', type: ShipmentResponseDto })
  @ApiResponse({ status: 400, description: 'Order không hợp lệ hoặc đã có shipment' })
  async createShipment(@Body() dto: CreateShipmentDto): Promise<ShipmentResponseDto> {
    return this.shippingService.createShipmentFromOrder(dto.orderId);
  }

  // Có thể thêm endpoint GET tất cả shipments cho admin (nếu cần)
// shipping.controller.ts
    @Get()
    @Roles(3) // ADMIN
    @ApiOperation({ summary: '[ADMIN] Lấy danh sách tất cả shipments (phân trang)' })
    @ApiResponse({ status: 200, description: 'Danh sách shipments' })
    async findAll(@Query() query: ShipmentQueryDto) {
    return this.shippingService.findAll(query);
    }
}