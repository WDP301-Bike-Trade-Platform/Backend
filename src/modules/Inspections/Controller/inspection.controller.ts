import { Controller, Post, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { InspectionService } from '../Service/inspection.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  CancelInspectionDto,
  CreateInspectionDto,
  InspectionQueryDto,
  UpdateInspectionDto,
  UpdateInspectionReportDto as UpdateReportDto,
} from '../DTOs/inspection.dto';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_id: number;
  };
}

@ApiTags('Inspections')
@ApiBearerAuth('access-token')
@Controller('inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  @Post()
  @Roles(1)
  @ApiOperation({ summary: 'Tạo yêu cầu kiểm định - user' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateInspectionDto) {
    return this.inspectionService.create(req.user.user_id, dto);
  }

  @Patch(':id/cancel')
  @Roles(1, 2, 3)
  @ApiOperation({ summary: 'Hủy yêu cầu kiểm định (theo quy định phân quyền)' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelInspectionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.cancel(id, req.user.user_id, req.user.role_id, dto);
  }

  @Get('my-requests')
  @Roles(1)
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu kiểm định do chính người dùng tạo' })
  async findMyRequests(@Req() req: RequestWithUser, @Query() query: InspectionQueryDto) {
    return this.inspectionService.findMyRequests(req.user.user_id, query);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách inspections - all' })
  async findAll(@Req() req: RequestWithUser, @Query() query: InspectionQueryDto) {
    return this.inspectionService.findAll(req.user.user_id, req.user.role_id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một inspection - all' })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.inspectionService.findOne(id, req.user.user_id, req.user.role_id);
  }

  @Patch(':id')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Cập nhật inspection - inspector/admin' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.update(id, dto, req.user.user_id, req.user.role_id);
  }

  @Patch(':id/report')
  @Roles(2)
  @ApiOperation({ summary: 'Inspector cập nhật báo cáo kiểm định' })
  async updateReport(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.updateReport(id, dto, req.user.user_id);
  }

  /**
   * Inspector tự nhận một inspection đang PENDING (chưa có ai nhận)
   */
  @Post(':id/assign')
  @Roles(2)
  @ApiOperation({ summary: 'Inspector tự nhận inspection' })
  async assignToSelf(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.inspectionService.assignToSelf(id, req.user.user_id);
  }
}