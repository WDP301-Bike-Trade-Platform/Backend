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
import { CreateListingService } from '../Service/createListing.service';
import { GetListingService } from '../Service/getListing.service';
import { CreateListingDto } from '../DTOs/create-listing.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ListingStatus } from '@prisma/client';

@ApiTags('Listing Products')
@ApiBearerAuth('access-token')
@Controller('listingProduct')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(
    private readonly createListingService: CreateListingService,
    private readonly getListingService: GetListingService,
  ) {}

  /**
   * ==========================
   * CREATE LISTING
   * ==========================
   * ROLE: SELLER (1)
   */
  @Roles(1)
  @Post('/create')
  @ApiOperation({ summary: 'Seller creates a new listing' })
  async createListing(@Body() dto: CreateListingDto, @Req() req: any) {
    const sellerId = req.user.user_id;
    return this.createListingService.createListing(dto, sellerId);
  }

  /**
   * ==========================
   * GET ALL LISTINGS
   * ==========================
   * ROLE:
   * - ADMIN (2): xem tất cả
   * - USER / BUYER: chỉ nên thấy listing đã APPROVED
   */
  @Roles(2, 3)
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

  /**
   * ==========================
   * GET MY LISTINGS
   * ==========================
   * ROLE: SELLER (1)
   */
  @Roles(1)
  @Get('/me')
  @ApiOperation({ summary: 'Seller gets their own listings' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', enum: ListingStatus, required: false })
  async getByMe(
    @Req() req: any,
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

  /**
   * ==========================
   * GET LISTING BY ID
   * ==========================
   * ROLE:
   * - ADMIN (2)
   * - USER / BUYER (3)
   */
  @Roles(2, 3)
  @Get('/:id')
  @ApiOperation({ summary: 'Get listing detail by id' })
  async getById(@Param('id') id: string) {
    return this.getListingService.getById(id);
  }
}
