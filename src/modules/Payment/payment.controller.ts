import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, type Response } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentLinkDto } from './dtos/create-payment-link.dto';
import { CreatePaymentLinkForOrderDto } from './dtos/create-payment-link-for-order.dto';
import { CancelPaymentDto } from './dtos/cancel-payment.dto';
import { PaymentWebhookDto } from './dtos/payment-webhook.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { JwtUser } from 'src/common/types/types';
import { ConfigService } from '@nestjs/config';

@ApiTags('Payment')
@ApiBearerAuth('access-token')
@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  private readonly DEEP_LINK_SCHEME: string;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {
    this.DEEP_LINK_SCHEME = this.configService.get<string>('DEEP_LINK_SCHEME') || 'biketrade://';
  }

  @Post('create-for-listing')
  @ApiOperation({ summary: 'Tạo payment link cho listing' })
  async createPaymentForListing(
    @Body() createPaymentLinkDto: CreatePaymentLinkDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const buyerId = req.user.user_id;
    return this.paymentService.createPaymentLinkForListing(
      createPaymentLinkDto.listingId,
      buyerId,
    );
  }

  @Post('create-for-order')
  @ApiOperation({ summary: 'Tạo payment link cho order (nhiều items)' })
  @ApiResponse({ status: 201, description: 'Payment link được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: 404, description: 'Order không tồn tại' })
  async createPaymentForOrder(
    @Body() dto: CreatePaymentLinkForOrderDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const buyerId = req.user.user_id;
    return this.paymentService.createPaymentLinkForOrder(dto.orderId, buyerId);
  }

  @Get('info/:orderCode')
  @ApiOperation({ summary: 'Lấy thông tin thanh toán theo order code' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy thanh toán' })
  async getPaymentInfo(@Param('orderCode', ParseIntPipe) orderCode: number) {
    return this.paymentService.getPaymentInfo(orderCode);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Hủy payment link' })
  @ApiResponse({ status: 200, description: 'Hủy thanh toán thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async cancelPayment(@Body() cancelPaymentDto: CancelPaymentDto) {
    return this.paymentService.cancelPaymentLink(
      cancelPaymentDto.orderCode,
      cancelPaymentDto.cancellationReason,
    );
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook từ PayOS - Xác thực payment' })
  @ApiResponse({ status: 200, description: 'Webhook xác thực thành công' })
  async handleWebhook(@Body() webhookData: PaymentWebhookDto) {
    // Xác thực webhook
    const result = await this.paymentService.handleWebhook(webhookData);

    if (!result.success) {
      return {
        success: false,
        message: 'Invalid webhook signature',
        error: result.error,
      };
    }

    // Trả về dữ liệu đã verify - logic xử lý order sẽ do module khác đảm nhận
    return {
      success: true,
      message: 'Webhook verified successfully',
      data: result.data,
    };
  }

  /**
   * Redirect endpoint cho PayOS success → deep link mobile app
   */
  @Public()
  @Get('redirect/success')
  @ApiOperation({ summary: 'Redirect từ PayOS checkout sang deep link (success)' })
  redirectSuccess(
    @Query('orderId') orderId: string,
    @Query('orderCode') orderCode: string,
    @Res() res: Response,
  ) {
    const deepLink = `${this.DEEP_LINK_SCHEME}payment/success?orderId=${orderId}&orderCode=${orderCode}`;
    return res.redirect(deepLink);
  }

  /**
   * Redirect endpoint cho PayOS cancel → deep link mobile app
   */
  @Public()
  @Get('redirect/cancel')
  @ApiOperation({ summary: 'Redirect từ PayOS checkout sang deep link (cancel)' })
  redirectCancel(
    @Query('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const deepLink = `${this.DEEP_LINK_SCHEME}payment/cancel?orderId=${orderId}`;
    return res.redirect(deepLink);
  }
}
