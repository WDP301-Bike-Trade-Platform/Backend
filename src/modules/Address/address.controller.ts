import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { JwtUser } from 'src/common/types/types';

@ApiTags('Address')
@ApiBearerAuth('access-token')
@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo địa chỉ mới' })
  @ApiResponse({ status: 201, description: 'Địa chỉ được tạo thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async create(
    @Body() createAddressDto: CreateAddressDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.create(req.user.user_id, createAddressDto);
  }

  @Get('my-addresses')
  @ApiOperation({ summary: 'Lấy tất cả địa chỉ của tôi' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách địa chỉ thành công' })
  async getMyAddresses(@Req() req: Request & { user: JwtUser }) {
    return this.addressService.getMyAddresses(req.user.user_id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Lấy địa chỉ mặc định' })
  @ApiResponse({ status: 200, description: 'Lấy địa chỉ mặc định thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy địa chỉ' })
  async getDefaultAddress(@Req() req: Request & { user: JwtUser }) {
    return this.addressService.getDefaultAddress(req.user.user_id);
  }

  @Get(':addressId')
  @ApiOperation({ summary: 'Lấy chi tiết một địa chỉ' })
  @ApiResponse({ status: 200, description: 'Lấy địa chỉ thành công' })
  @ApiResponse({ status: 404, description: 'Địa chỉ không tồn tại' })
  async getAddressById(
    @Param('addressId') addressId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.getAddressById(req.user.user_id, addressId);
  }

  @Patch(':addressId')
  @ApiOperation({ summary: 'Cập nhật địa chỉ' })
  @ApiResponse({ status: 200, description: 'Cập nhật địa chỉ thành công' })
  @ApiResponse({ status: 404, description: 'Địa chỉ không tồn tại' })
  async update(
    @Param('addressId') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.update(
      req.user.user_id,
      addressId,
      updateAddressDto,
    );
  }

  @Patch(':addressId/set-default')
  @ApiOperation({ summary: 'Đặt địa chỉ làm mặc định' })
  @ApiResponse({ status: 200, description: 'Đặt địa chỉ mặc định thành công' })
  @ApiResponse({ status: 404, description: 'Địa chỉ không tồn tại' })
  async setAsDefault(
    @Param('addressId') addressId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.setAsDefault(req.user.user_id, addressId);
  }

  @Delete(':addressId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa địa chỉ' })
  @ApiResponse({ status: 200, description: 'Xóa địa chỉ thành công' })
  @ApiResponse({ status: 404, description: 'Địa chỉ không tồn tại' })
  async delete(
    @Param('addressId') addressId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.delete(req.user.user_id, addressId);
  }
}
