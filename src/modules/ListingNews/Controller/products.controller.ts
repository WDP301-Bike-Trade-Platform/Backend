import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateListingService } from '../Service/createListing.service';
import { GetListingService } from '../Service/getListing.service';
import { UpdateListingService } from '../Service/updateListing.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { UpdateListingDto } from '../DTOs/update-listing.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { ListingStatus } from '@prisma/client';
import { ChangeListingStatusDto } from '../DTOs/seller-update-listing-status.dto';
import { ChangeListingStatusService } from '../Service/sellerListingStatus.service';
import { JwtUser } from 'src/common/types/types';

@ApiTags('Listing Products')
@ApiBearerAuth('access-token')
@Controller('listingProduct')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly createListingService: CreateListingService,
    private readonly getListingService: GetListingService,
    private readonly updateListingService: UpdateListingService,
    private readonly changeListingStatusService: ChangeListingStatusService,
  ) {}

  @Roles(1)
  @Post('/create')
  @ApiOperation({ summary: 'Seller creates a new listing' })
  async createListing(
    @Body() dto: CreateListingDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    const sellerId = req.user.user_id;
    return this.createListingService.createListing(dto, sellerId);
  }

  @Roles(1)
  @Patch('/:id')
  @ApiOperation({ summary: 'Seller updates their pending listing' })
  async updateListing(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
    @Body() dto: UpdateListingDto,
  ) {
    const sellerId = req.user.user_id;
    return this.updateListingService.updateListing(id, sellerId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all listings (admin / public)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: ListingStatus, required: false })
  async getAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ListingStatus,
  ) {
    return this.getListingService.getAll({
      page: Number(page),
      limit: Number(limit),
      status,
    });
  }

  @Roles(1)
  @Get('/me')
  @ApiOperation({ summary: 'Seller gets their own listings' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: ListingStatus, required: false })
  async getByMe(
    @Req() req: Request & { user: JwtUser },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: ListingStatus,
  ) {
    const sellerId = req.user.user_id;

    return this.getListingService.getByMe(sellerId, {
      page: Number(page),
      limit: Number(limit),
      status,
    });
  }

  @Roles(2, 3)
  @Get('/:id')
  @ApiOperation({ summary: 'Get listing detail by id' })
  async getById(@Param('id') id: string) {
    return this.getListingService.getById(id);
  }

  @Roles(1)
  @Patch('/:id/status')
  @ApiOperation({ summary: 'Seller change listing status (hide/show/sold)' })
  async changeStatus(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
    @Body() dto: ChangeListingStatusDto,
  ) {
    const sellerId = req.user.user_id;
    return this.changeListingStatusService.changeStatus(id, sellerId, dto);
  }
}
