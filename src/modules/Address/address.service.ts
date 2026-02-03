import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo địa chỉ mới
   */
  async create(userId: string, dto: CreateAddressDto) {
    // Nếu đặt làm mặc định, bỏ mặc định các địa chỉ khác
    if (dto.is_default) {
      await this.prisma.address.updateMany({
        where: {
          user_id: userId,
          is_default: true,
        },
        data: {
          is_default: false,
        },
      });
    }

    // Nếu đây là địa chỉ đầu tiên, tự động set làm mặc định
    const addressCount = await this.prisma.address.count({
      where: { user_id: userId },
    });

    const address = await this.prisma.address.create({
      data: {
        user_id: userId,
        label: dto.label,
        recipient_name: dto.recipient_name,
        phone: dto.phone,
        address_line1: dto.address_line1,
        address_line2: dto.address_line2,
        ward: dto.ward,
        district: dto.district,
        city: dto.city,
        postal_code: dto.postal_code,
        country: dto.country || 'Vietnam',
        is_default: addressCount === 0 ? true : (dto.is_default || false),
        created_at: new Date(),
      },
    });

    return {
      success: true,
      message: 'Address created successfully',
      data: address,
    };
  }

  /**
   * Lấy tất cả địa chỉ của user
   */
  async getMyAddresses(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { user_id: userId },
      orderBy: [
        { is_default: 'desc' }, // Địa chỉ mặc định lên đầu
        { created_at: 'desc' },
      ],
    });

    return {
      success: true,
      data: addresses,
    };
  }

  /**
   * Lấy địa chỉ mặc định
   */
  async getDefaultAddress(userId: string) {
    const address = await this.prisma.address.findFirst({
      where: {
        user_id: userId,
        is_default: true,
      },
    });

    if (!address) {
      // Nếu không có địa chỉ mặc định, lấy địa chỉ đầu tiên
      const firstAddress = await this.prisma.address.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      });

      if (!firstAddress) {
        throw new NotFoundException('No address found');
      }

      return {
        success: true,
        data: firstAddress,
      };
    }

    return {
      success: true,
      data: address,
    };
  }

  /**
   * Lấy chi tiết một địa chỉ
   */
  async getAddressById(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { address_id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.user_id !== userId) {
      throw new BadRequestException('This address does not belong to you');
    }

    return {
      success: true,
      data: address,
    };
  }

  /**
   * Cập nhật địa chỉ
   */
  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    // Kiểm tra quyền sở hữu
    const address = await this.prisma.address.findUnique({
      where: { address_id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.user_id !== userId) {
      throw new BadRequestException('This address does not belong to you');
    }

    // Nếu đặt làm mặc định, bỏ mặc định các địa chỉ khác
    if (dto.is_default) {
      await this.prisma.address.updateMany({
        where: {
          user_id: userId,
          is_default: true,
          address_id: { not: addressId },
        },
        data: {
          is_default: false,
        },
      });
    }

    const updatedAddress = await this.prisma.address.update({
      where: { address_id: addressId },
      data: {
        ...dto,
      },
    });

    return {
      success: true,
      message: 'Address updated successfully',
      data: updatedAddress,
    };
  }

  /**
   * Đặt địa chỉ làm mặc định
   */
  async setAsDefault(userId: string, addressId: string) {
    // Kiểm tra quyền sở hữu
    const address = await this.prisma.address.findUnique({
      where: { address_id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.user_id !== userId) {
      throw new BadRequestException('This address does not belong to you');
    }

    // Bỏ mặc định các địa chỉ khác
    await this.prisma.address.updateMany({
      where: {
        user_id: userId,
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });

    // Đặt địa chỉ này làm mặc định
    const updatedAddress = await this.prisma.address.update({
      where: { address_id: addressId },
      data: {
        is_default: true,
      },
    });

    return {
      success: true,
      message: 'Address set as default successfully',
      data: updatedAddress,
    };
  }

  /**
   * Xóa địa chỉ
   */
  async delete(userId: string, addressId: string) {
    // Kiểm tra quyền sở hữu
    const address = await this.prisma.address.findUnique({
      where: { address_id: addressId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    if (address.user_id !== userId) {
      throw new BadRequestException('This address does not belong to you');
    }

    // Xóa địa chỉ
    await this.prisma.address.delete({
      where: { address_id: addressId },
    });

    // Nếu xóa địa chỉ mặc định, đặt địa chỉ đầu tiên làm mặc định
    if (address.is_default) {
      const firstAddress = await this.prisma.address.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      });

      if (firstAddress) {
        await this.prisma.address.update({
          where: { address_id: firstAddress.address_id },
          data: { is_default: true },
        });
      }
    }

    return {
      success: true,
      message: 'Address deleted successfully',
    };
  }
}
