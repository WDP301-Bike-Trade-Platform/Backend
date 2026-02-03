import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { JwtUser } from 'src/common/types/types';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post('add')
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ hàng' })
  @ApiResponse({ status: 201, description: 'Thêm thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Listing không tồn tại' })
  async addToCart(
    @Body() addToCartDto: AddToCartDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const buyerId = req.user.user_id;
    return this.cartService.addToCart(buyerId, addToCartDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy giỏ hàng của tôi' })
  @ApiResponse({ status: 200, description: 'Lấy thành công' })
  async getMyCart(@Req() req: Request & { user: JwtUser }) {
    const buyerId = req.user.user_id;
    return this.cartService.getMyCart(buyerId);
  }

  @Patch('items/:cartItemId')
  @ApiOperation({ summary: 'Cập nhật số lượng item trong giỏ hàng' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 404, description: 'Cart item không tồn tại' })
  async updateCartItem(
    @Param('cartItemId') cartItemId: string,
    @Body() updateDto: UpdateCartItemDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const buyerId = req.user.user_id;
    return this.cartService.updateCartItem(buyerId, cartItemId, updateDto);
  }

  @Delete('items/:cartItemId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa item khỏi giỏ hàng' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Cart item không tồn tại' })
  async removeFromCart(
    @Param('cartItemId') cartItemId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    const buyerId = req.user.user_id;
    return this.cartService.removeFromCart(buyerId, cartItemId);
  }

  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa tất cả items trong giỏ hàng' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  async clearCart(@Req() req: Request & { user: JwtUser }) {
    const buyerId = req.user.user_id;
    return this.cartService.clearCart(buyerId);
  }

  @Get('validate')
  @ApiOperation({ summary: 'Kiểm tra giỏ hàng trước khi checkout' })
  @ApiResponse({ status: 200, description: 'Kiểm tra thành công' })
  @ApiResponse({ status: 400, description: 'Có items không khả dụng' })
  async validateCart(@Req() req: Request & { user: JwtUser }) {
    const buyerId = req.user.user_id;
    return this.cartService.getCartForOrder(buyerId);
  }
}
