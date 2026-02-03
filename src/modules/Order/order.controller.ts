import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderFromCartDto } from './dto/create-order-from-cart.dto';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtUser } from 'src/common/types/types';
import { OrderStatus } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles(1) // USER
  @ApiOperation({ summary: 'Tạo order mới từ listing' })
  @ApiResponse({ status: 201, description: 'Order được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Listing không tồn tại' })
  async createOrder(
    @Body() createOrderDto: CreateOrderDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.orderService.createOrder(req.user.user_id, createOrderDto);
  }

  @Post('checkout-cart')
  @Roles(1) // USER
  @ApiOperation({ summary: 'Tạo order từ giỏ hàng (checkout)' })
  @ApiResponse({
    status: 201,
    description: 'Orders được tạo thành công từ giỏ hàng',
  })
  @ApiResponse({ status: 400, description: 'Giỏ hàng trống hoặc có lỗi' })
  async checkoutCart(
    @Body() dto: CreateOrderFromCartDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.orderService.createOrderFromCart(req.user.user_id, dto);
  }

  @Get('my-orders')
  @Roles(1) // USER/BUYER
  @ApiOperation({ summary: 'Lấy danh sách orders của buyer' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async getMyOrders(
    @Req() req: Request & { user: JwtUser },
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getMyOrders(req.user.user_id, status);
  }

  @Get('seller-orders')
  @Roles(1) // USER/SELLER
  @ApiOperation({ summary: 'Lấy danh sách orders cho seller' })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async getOrdersForSeller(
    @Req() req: Request & { user: JwtUser },
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.getOrdersForSeller(req.user.user_id, status);
  }

  @Get(':id')
  @Roles(1) // USER
  @ApiOperation({ summary: 'Lấy chi tiết order' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  @ApiResponse({ status: 404, description: 'Order không tồn tại' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async getOrderById(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.orderService.getOrderById(id, req.user.user_id);
  }

  @Patch(':id/confirm')
  @Roles(1) // SELLER
  @ApiOperation({ summary: 'Seller xác nhận đơn hàng' })
  @ApiResponse({ status: 200, description: 'Xác nhận thành công' })
  @ApiResponse({ status: 400, description: 'Không thể xác nhận order này' })
  @ApiResponse({ status: 403, description: 'Không phải seller' })
  async confirmOrder(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
    @Body() confirmOrderDto: ConfirmOrderDto,
  ) {
    return this.orderService.confirmOrder(
      id,
      req.user.user_id,
      confirmOrderDto.note,
    );
  }

  @Patch(':id/cancel')
  @Roles(1) // BUYER
  @ApiOperation({ summary: 'Buyer hủy đơn hàng' })
  @ApiResponse({ status: 200, description: 'Hủy order thành công' })
  @ApiResponse({ status: 400, description: 'Không thể hủy order này' })
  @ApiResponse({ status: 403, description: 'Không phải buyer' })
  async cancelOrder(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
    @Body() cancelOrderDto: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(
      id,
      req.user.user_id,
      cancelOrderDto.reason,
    );
  }

  @Patch(':id/complete')
  @Roles(1) // SELLER
  @ApiOperation({ summary: 'Seller hoàn thành đơn hàng' })
  @ApiResponse({ status: 200, description: 'Hoàn thành order thành công' })
  @ApiResponse({ status: 400, description: 'Không thể hoàn thành order này' })
  @ApiResponse({ status: 403, description: 'Không phải seller' })
  async completeOrder(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.orderService.completeOrder(id, req.user.user_id);
  }
}
