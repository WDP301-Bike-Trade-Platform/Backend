import { Controller, Post, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { InspectionService } from '../Service/inspection.service';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CancelInspectionDto, CreateInspectionDto, InspectionQueryDto, UpdateInspectionDto, UpdateReportDto } from '../DTOs/inspection.dto';
import type { Request } from 'express';

// Define interface for user in request
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
    const userId = req.user.user_id;
    return this.inspectionService.create(userId, dto);
  }
  @Patch(':id/cancel')
  @Roles(1, 2, 3) // USER, INSPECTOR, ADMIN đều có thể gọi (service tự kiểm tra quyền cụ thể)
  @ApiOperation({ summary: 'Hủy yêu cầu kiểm định (theo quy định phân quyền)' })
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelInspectionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.inspectionService.cancel(id, req.user.user_id, req.user.role_id, dto);
  }
  @Roles(1)
  @Get('my-requests')
  @ApiOperation({ summary: 'Lấy danh sách yêu cầu kiểm định do chính người dùng tạo' })
  async findMyRequests(@Req() req: RequestWithUser, @Query() query: InspectionQueryDto) {
    return this.inspectionService.findMyRequests(req.user.user_id, query);
  }
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách inspections - all' })
  async findAll(@Req() req: RequestWithUser, @Query() query: InspectionQueryDto) {
    const userId = req.user.user_id;
    const roleId = req.user.role_id;
    return this.inspectionService.findAll(userId, roleId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết một inspection - all' })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    const userId = req.user.user_id;
    const roleId = req.user.role_id;
    return this.inspectionService.findOne(id, userId, roleId);
  }

  @Patch(':id')
  @Roles(2, 3)
  @ApiOperation({ summary: 'Cập nhật inspection - inspector/admin' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.user_id;
    const roleId = req.user.role_id;
    return this.inspectionService.update(id, dto, userId, roleId);
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
}