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
   * Trả về HTML page dùng JavaScript để mở deep link (vì browser không follow
   * HTTP 302 redirect tới custom scheme như exp:// hay biketrade://)
   */
  @Public()
  @Get('redirect/success')
  @ApiOperation({ summary: 'Redirect từ PayOS checkout sang deep link (success)' })
  async redirectSuccess(
    @Query('orderId') orderId: string,
    @Query('orderCode') orderCode: string,
    @Res() res: Response,
  ) {
    const deepLink = `${this.DEEP_LINK_SCHEME}payment/success?orderId=${orderId}&orderCode=${orderCode}`;
    return res.send(this.buildRedirectHtml(deepLink, 'Thanh toán thành công'));
  }

  /**
   * Redirect endpoint cho PayOS cancel → deep link mobile app
   */
  @Public()
  @Get('redirect/cancel')
  @ApiOperation({ summary: 'Redirect từ PayOS checkout sang deep link (cancel)' })
  async redirectCancel(
    @Query('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const deepLink = `${this.DEEP_LINK_SCHEME}payment/cancel?orderId=${orderId}`;
    return res.send(this.buildRedirectHtml(deepLink, 'Đang quay lại ứng dụng...'));
  }

  /**
   * Tạo HTML page để redirect về app qua JavaScript
   * Browser không follow HTTP 302 tới custom scheme, nên dùng JS window.location
   */
  private buildRedirectHtml(deepLink: string, title: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
          .container { text-align: center; padding: 20px; }
          a { color: #007AFF; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <p>${title}</p>
          <p>Đang mở ứng dụng...</p>
          <p><a href="${deepLink}">Nhấn vào đây nếu ứng dụng không tự mở</a></p>
        </div>
        <script>
          window.location.href = "${deepLink}";
        </script>
      </body>
      </html>
    `;
  }
}
