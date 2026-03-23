import { Controller, Post, Patch, Param, Body, Req, UseGuards, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { OfferService } from '../Service/offer.service';
import { CreateOfferDto } from '../DTOs/create-offer.dto';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_name: string;
  };
}

@ApiTags('Offers (Trả giá)')
@ApiBearerAuth('access-token')
@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OfferController {
  constructor(private readonly offerService: OfferService) { }

  @Get(':id')
  @Roles(1) // USER
  @ApiOperation({ summary: '[BUYER] Lấy lời trả giá theo ID' })
  async getOfferById(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.offerService.getOfferById(id, req.user.user_id);
  }

  @Post()
  @Roles(1) // USER
  @ApiOperation({ summary: '[BUYER] Tạo lời trả giá mới' })
  async createOffer(@Body() dto: CreateOfferDto, @Req() req: RequestWithUser) {
    return this.offerService.createOffer(req.user.user_id, dto);
  }
  @Patch(':id/accept')
  @Roles(1) // USER
  @ApiOperation({ summary: '[SELLER] Đồng ý lời trả giá' })
  async acceptOffer(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.offerService.acceptOffer(id, req.user.user_id);
  }

  @Patch(':id/reject')
  @Roles(1) // USER
  @ApiOperation({ summary: '[SELLER] Từ chối lời trả giá' })
  async rejectOffer(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.offerService.rejectOffer(id, req.user.user_id);
  }

  @Patch(':id/cancel')
  @Roles(1) // USER
  @ApiOperation({ summary: '[BUYER] Hủy lời trả giá khi chưa được xử lý' })
  async cancelOffer(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.offerService.cancelOffer(id, req.user.user_id);
  }
}
