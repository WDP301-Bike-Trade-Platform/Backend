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
  @ApiOperation({ summary: 'Create a new address' })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async create(
    @Body() createAddressDto: CreateAddressDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.create(req.user.user_id, createAddressDto);
  }

  @Get('my-addresses')
  @ApiOperation({ summary: 'Get all my addresses' })
  @ApiResponse({ status: 200, description: 'Addresses retrieved successfully' })
  async getMyAddresses(@Req() req: Request & { user: JwtUser }) {
    return this.addressService.getMyAddresses(req.user.user_id);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default address' })
  @ApiResponse({ status: 200, description: 'Default address retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async getDefaultAddress(@Req() req: Request & { user: JwtUser }) {
    return this.addressService.getDefaultAddress(req.user.user_id);
  }

  @Get(':addressId')
  @ApiOperation({ summary: 'Get address details' })
  @ApiResponse({ status: 200, description: 'Address retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async getAddressById(
    @Param('addressId') addressId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.getAddressById(req.user.user_id, addressId);
  }

  @Patch(':addressId')
  @ApiOperation({ summary: 'Update address' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
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
  @ApiOperation({ summary: 'Set address as default' })
  @ApiResponse({ status: 200, description: 'Default address set successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async setAsDefault(
    @Param('addressId') addressId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.setAsDefault(req.user.user_id, addressId);
  }

  @Delete(':addressId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete address' })
  @ApiResponse({ status: 200, description: 'Address deleted successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async delete(
    @Param('addressId') addressId: string,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.addressService.delete(req.user.user_id, addressId);
  }
}
