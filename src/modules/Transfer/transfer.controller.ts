import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { TransferService } from './transfer.service';
import { CreateTransferDto } from './dtos/create-transfer.dto';
import { CreateBatchTransferDto } from './dtos/create-batch-transfer.dto';
import { EstimateCreditDto } from './dtos/estimate-credit.dto';

@ApiTags('Transfers')
@ApiBearerAuth('access-token')
@Controller('transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @Roles(2, 3)
  @ApiOperation({ summary: 'Tạo payout PayOS cho 1 người nhận' })
  @ApiResponse({ status: 201, description: 'Tạo chuyển khoản thành công' })
  async createTransfer(
    @Body() dto: CreateTransferDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.createTransfer(req.user.user_id, dto);
  }

  @Post('batch')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Tạo payout PayOS theo danh sách người nhận' })
  async createBatchTransfer(
    @Body() dto: CreateBatchTransferDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.createBatchTransfer(req.user.user_id, dto);
  }

  @Get(':transferId')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Lấy chi tiết chuyển khoản theo ID' })
  async getTransfer(
    @Param('transferId') transferId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.getTransferById(transferId, req.user.user_id);
  }

  @Get('reference/:referenceId')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Lấy chi tiết chuyển khoản theo mã reference' })
  async getTransferByReference(
    @Param('referenceId') referenceId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.getTransferByReference(
      referenceId,
      req.user.user_id,
    );
  }

  @Get()
  @Roles(2, 3)
  @ApiOperation({ summary: 'Lấy danh sách chuyển khoản của admin hiện tại' })
  async getTransfers(@Req() req: Request & { user: JwtUser }) {
    return this.transferService.getTransfersForUser(req.user.user_id);
  }

  @Get('account-balance')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Lấy số dư tài khoản PayOS payouts' })
  async getAccountBalance() {
    return this.transferService.getAccountBalance();
  }

  @Post('estimate-credit')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Ước tính hạn mức cần thiết cho batch payout' })
  async estimateCredit(@Body() dto: EstimateCreditDto) {
    return this.transferService.estimateCredit(dto);
  }
}
