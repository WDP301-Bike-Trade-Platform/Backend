import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';
import { User } from '../../common/decorators/user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('User')
@ApiBearerAuth('access-token')
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /user/profile
   * Lấy thông tin profile của user đang đăng nhập
   */
  @ApiOperation({ summary: 'Lấy thông tin profile của user đang đăng nhập' })
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  getProfile(@User('sub') userId: string) {
    return this.userService.getProfile(userId);
  }

  /**
   * PUT /user/profile
   * Cập nhật thông tin profile của user đang đăng nhập
   */
  @ApiOperation({
    summary: 'Cập nhật thông tin profile của user đang đăng nhập',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  @Put('profile')
  @HttpCode(HttpStatus.OK)
  updateProfile(@User('sub') userId: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateProfile(userId, dto);
  }
}
