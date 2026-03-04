import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtUser } from 'src/common/types/types';
import { AdminOrderService } from './admin-order.service';
import { AdminOrderListQueryDto } from './dto/admin-order-query.dto';
import { AdminUpdateOrderStatusDto } from './dto/admin-update-order-status.dto';

@ApiTags('Admin Orders')
@ApiBearerAuth('access-token')
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(3) // ADMIN
export class AdminOrderController {
  constructor(private readonly adminOrderService: AdminOrderService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn hàng (Admin)' })
  @ApiResponse({ status: 200, description: 'Danh sách đơn hàng' })
  async getOrders(@Query() query: AdminOrderListQueryDto) {
    return this.adminOrderService.getOrders(query);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Lấy chi tiết đơn hàng (Admin)' })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn hàng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  async getById(@Param('orderId') orderId: string) {
    return this.adminOrderService.getById(orderId);
  }

  @Put(':orderId/status')
  @ApiOperation({ summary: 'Cập nhật trạng thái đơn hàng (Admin)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Trạng thái không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  async updateStatus(
    @Param('orderId') orderId: string,
    @Req() req: Request & { user: JwtUser },
    @Body() dto: AdminUpdateOrderStatusDto,
  ) {
    return this.adminOrderService.updateStatus(
      req.user.user_id,
      orderId,
      dto,
    );
  }
}
