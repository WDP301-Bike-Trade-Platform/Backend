import {
  Controller,
  Post,
  Patch,
  Get,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ReportService } from '../Service/report.service';
import { CreateReportDto, ReportQueryDto, UpdateReportDto } from '../DTOs/report.dto';

// Define extended request interface
interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_id: number;
  };
}

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  @Roles(1) // USER
  @ApiOperation({ summary: 'Tạo báo cáo (người dùng)' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateReportDto) {
    return this.reportService.create(req.user.user_id, dto);
  }

  @Patch(':id/cancel')
  @Roles(1) // USER
  @ApiOperation({ summary: 'Hủy báo cáo của chính mình (nếu đang PENDING)' })
  async cancel(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.reportService.cancel(id, req.user.user_id);
  }

  @Get('admin')
  @Roles(3) // ADMIN
  @ApiOperation({ summary: '[Admin] Lấy danh sách báo cáo' })
  async findAllForAdmin(@Query() query: ReportQueryDto) {
    return this.reportService.findAllForAdmin(query);
  }

  @Get('admin/:id')
  @Roles(3)
  @ApiOperation({ summary: '[Admin] Xem chi tiết báo cáo' })
  async findOne(@Param('id') id: string) {
    return this.reportService.findOne(id);
  }

  @Patch('admin/:id/process')
  @Roles(3)
  @ApiOperation({ summary: '[Admin] Xử lý báo cáo (cập nhật trạng thái, kết quả)' })
  async process(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @Req() req: RequestWithUser,
  ) {
    return this.reportService.process(id, dto, req.user.user_id);
  }
}