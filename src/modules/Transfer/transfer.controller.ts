import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
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
  constructor(private readonly transferService: TransferService) { }

  @Get('admin/all')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Admin: Get all transfers with order details' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by approval_state (e.g. DRAFTING, REJECTED)' })
  async getAllTransfers(@Query('status') status?: string) {
    return this.transferService.getAllTransfers(status);
  }

  @Post(':id/execute')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Admin: Execute a DRAFTING transfer via PayOS' })
  @ApiResponse({ status: 200, description: 'Transfer executed successfully' })
  @ApiResponse({ status: 400, description: 'Bank info missing or transfer not in DRAFTING state' })
  async executeDraftTransfer(@Param('id') id: string) {
    return this.transferService.executeDraftTransfer(id);
  }

  @Post(':id/reject')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Admin: Reject a DRAFTING transfer' })
  @ApiResponse({ status: 200, description: 'Transfer rejected successfully' })
  async rejectDraftTransfer(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.transferService.rejectDraftTransfer(id, reason);
  }

  @Get('my-history')
  @Roles(1, 2, 3)
  @ApiOperation({ summary: 'Get my transfer/refund history' })
  async getMyHistory(@Req() req: Request & { user: JwtUser }) {
    return this.transferService.getMyTransferHistory(req.user.user_id);
  }

  @Post()
  @Roles(2, 3)
  @ApiOperation({ summary: 'Create payout for 1 recipient' })
  @ApiResponse({ status: 201, description: 'Transfer created successfully' })
  async createTransfer(
    @Body() dto: CreateTransferDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.createTransfer(req.user.user_id, dto);
  }

  @Post('batch')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Create batch payout for multiple recipients' })
  async createBatchTransfer(
    @Body() dto: CreateBatchTransferDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.createBatchTransfer(req.user.user_id, dto);
  }

  @Post('estimate-credit')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Estimate credit needed for batch payout' })
  async estimateCredit(@Body() dto: EstimateCreditDto) {
    return this.transferService.estimateCredit(dto);
  }

  @Get()
  @Roles(2, 3)
  @ApiOperation({ summary: 'Get transfer list for current admin' })
  async getTransfers(@Req() req: Request & { user: JwtUser }) {
    return this.transferService.getTransfersForUser(req.user.user_id);
  }

  @Get('account-balance')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Get PayOS payout account balance' })
  async getAccountBalance() {
    return this.transferService.getAccountBalance();
  }

  @Get('reference/:referenceId')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Get transfer details by reference code' })
  async getTransferByReference(
    @Param('referenceId') referenceId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.getTransferByReference(
      referenceId,
      req.user.user_id,
    );
  }

  @Get(':transferId')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Get transfer details by ID' })
  async getTransfer(
    @Param('transferId') transferId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.transferService.getTransferById(transferId, req.user.user_id);
  }
}

