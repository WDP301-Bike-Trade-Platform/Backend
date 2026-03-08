import { Controller, Get, Param, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse, ApiNotFoundResponse, ApiBadRequestResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminUserService } from '../service/admin-user.service';
import { AdminUserQueryDto, UpdateUserStatusDto } from '../dto/admin-user.dto';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_id: number;
  };
}

@ApiTags('Admin Users')
@ApiBearerAuth('access-token')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(3) // ADMIN
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Lấy danh sách người dùng',
    description: 'Trả về danh sách người dùng với phân trang và các bộ lọc: role, trạng thái, ngày tham gia, tìm kiếm theo tên/email.' 
  })
  @ApiOkResponse({ description: 'Danh sách người dùng' })
  async findAll(@Query() query: AdminUserQueryDto) {
    return this.adminUserService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Lấy chi tiết người dùng',
    description: 'Trả về thông tin chi tiết của một người dùng bao gồm profile và địa chỉ.' 
  })
  @ApiOkResponse({ description: 'Thông tin người dùng' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng' })
  async findOne(@Param('id') id: string) {
    return this.adminUserService.findOne(id);
  }

  @Get(':id/activity')
  @ApiOperation({ 
    summary: 'Lấy chi tiết hoạt động của người dùng',
    description: 'Trả về các hoạt động gần đây của người dùng: listings, orders, reviews, reports, inspections, messages và thống kê số lượng.' 
  })
  @ApiOkResponse({ description: 'Chi tiết hoạt động' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng' })
  async getUserActivity(@Param('id') id: string) {
    return this.adminUserService.getUserActivity(id);
  }

  @Patch(':id/status')
  @ApiOperation({ 
    summary: 'Cập nhật trạng thái khóa/mở khóa tài khoản',
    description: 'Khóa tài khoản bằng cách gửi lockedUntil (thời gian khóa đến). Gửi lockedUntil = null để mở khóa. Hệ thống sẽ gửi thông báo đến người dùng.'
  })
  @ApiOkResponse({ description: 'Cập nhật thành công' })
  @ApiBadRequestResponse({ description: 'Dữ liệu không hợp lệ (ví dụ: lockedUntil không đúng định dạng)' })
  @ApiNotFoundResponse({ description: 'Không tìm thấy người dùng' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: RequestWithUser,
  ) {
    return this.adminUserService.updateStatus(id, dto, req.user.user_id);
  }
}