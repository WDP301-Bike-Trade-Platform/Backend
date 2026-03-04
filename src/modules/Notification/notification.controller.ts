import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  Query,
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
import { NotificationService } from './notification.service';
import { NotificationListQueryDto } from './dto/notification-query.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Roles(1) // USER
  @ApiOperation({ summary: 'Lấy danh sách thông báo của user' })
  @ApiResponse({ status: 200, description: 'Lấy thông báo thành công' })
  async getMyNotifications(
    @Req() req: Request & { user: JwtUser },
    @Query() query: NotificationListQueryDto,
  ) {
    return this.notificationService.getMyNotifications(
      req.user.user_id,
      query,
    );
  }

  @Patch(':id/read')
  @Roles(1)
  @ApiOperation({ summary: 'Đánh dấu thông báo đã đọc' })
  @ApiResponse({ status: 200, description: 'Đánh dấu thành công' })
  async markAsRead(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.notificationService.markAsRead(req.user.user_id, id);
  }

  @Patch('read-all')
  @Roles(1)
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo đã đọc' })
  @ApiResponse({ status: 200, description: 'Đánh dấu thành công' })
  async markAllAsRead(@Req() req: Request & { user: JwtUser }) {
    return this.notificationService.markAllAsRead(req.user.user_id);
  }
}
