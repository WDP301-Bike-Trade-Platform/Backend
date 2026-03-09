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
  @ApiOperation({ summary: 'Create payment link for listing' })
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
  @ApiOperation({ summary: 'Create payment link for order (multiple items)' })
  @ApiResponse({ status: 201, description: 'Payment link created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async createPaymentForOrder(
    @Body() dto: CreatePaymentLinkForOrderDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const buyerId = req.user.user_id;
    return this.paymentService.createPaymentLinkForOrder(dto.orderId, buyerId);
  }

  @Get('info/:orderCode')
  @ApiOperation({ summary: 'Get payment info by order code' })
  @ApiResponse({ status: 200, description: 'Payment info retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentInfo(@Param('orderCode', ParseIntPipe) orderCode: number) {
    return this.paymentService.getPaymentInfo(orderCode);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel payment link' })
  @ApiResponse({ status: 200, description: 'Payment cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async cancelPayment(@Body() cancelPaymentDto: CancelPaymentDto) {
    return this.paymentService.cancelPaymentLink(
      cancelPaymentDto.orderCode,
      cancelPaymentDto.cancellationReason,
    );
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayOS Webhook - Verify payment' })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  async handleWebhook(@Body() webhookData: PaymentWebhookDto) {
    // Xác thực webhook
    const result = await this.paymentService.handleWebhook(webhookData);

    if (!result.success) {
      return {
        success: false,
        message: result.message ?? 'Webhook processing failed',
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
  @ApiOperation({ summary: 'Redirect from PayOS checkout to deep link (success)' })
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
  @ApiOperation({ summary: 'Redirect from PayOS checkout to deep link (cancel)' })
  redirectCancel(
    @Query('orderId') orderId: string,
    @Res() res: Response,
  ) {
    const deepLink = `${this.DEEP_LINK_SCHEME}payment/cancel?orderId=${orderId}`;
    return res.redirect(deepLink);
  }
}
