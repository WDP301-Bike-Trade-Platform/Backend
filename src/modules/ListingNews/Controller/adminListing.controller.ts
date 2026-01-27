import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminApproveListingDto } from '../DTOs/admin-approve-listing.dto';
import { AdminRejectListingDto } from '../DTOs/admin-reject-listing.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminListingService } from '../Service/adminApprovedListing.service';
import { Request } from 'express';
import { JwtUser } from 'src/common/types/types';

@ApiTags('Admin - Listings')
@ApiBearerAuth('access-token')
@Controller('admin/listings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(2, 3)
export class AdminListingController {
  constructor(private readonly service: AdminListingService) {}

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Admin approves a listing' })
  approve(
    @Param('id') listingId: string,
    @Req() req: Request & { user: JwtUser },
    @Body() dto: AdminApproveListingDto,
  ) {
    return this.service.approveListing(listingId, req.user.user_id, dto.note);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Admin rejects a listing' })
  reject(
    @Param('id') listingId: string,
    @Req() req: Request & { user: JwtUser },
    @Body() dto: AdminRejectListingDto,
  ) {
    return this.service.rejectListing(listingId, req.user.user_id, dto.note);
  }
}
