import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { CreatePaymentLinkDto } from './dtos/create-payment-link.dto';
import { CancelPaymentDto } from './dtos/cancel-payment.dto';
import { PaymentWebhookDto } from './dtos/payment-webhook.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { JwtUser } from 'src/common/types/types';

@ApiTags('Payment')
@ApiBearerAuth('access-token')
@Controller('payment')
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
    const result = await this.paymentService.verifyWebhook(webhookData);

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
}
