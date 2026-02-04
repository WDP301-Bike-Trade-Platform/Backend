import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy thông tin profile của user đang đăng nhập
   */
  async getProfile(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone: true,
        role_id: true,
        is_verified: true,
        violation_count: true,
        locked_until: true,
        created_at: true,
        profile: {
          select: {
            profile_id: true,
            dob: true,
            gender: true,
            national_id: true,
            bank_account: true,
            bank_name: true,
            avatar_url: true,
            created_at: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return {
      ok: true,
      data: {
        ...user,
        created_at: user.created_at?.toISOString(),
        profile: user.profile ? {
          ...user.profile,
          dob: user.profile.dob?.toISOString(),
          created_at: user.profile.created_at?.toISOString(),
        } : null,
      },
    };
  }

  /**
   * Cập nhật thông tin profile của user đang đăng nhập
   */
  async updateProfile(userId: string, dto: UpdateUserDto) {
    // Kiểm tra user có tồn tại không
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    // Kiểm tra phone trùng lặp (nếu có thay đổi)
    if (dto.phone && dto.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });

      if (existingPhone) {
        throw new BadRequestException('Số điện thoại đã được sử dụng');
      }
    }

    // Cập nhật thông tin user (full_name, phone)
    const updatedUser = await this.prisma.user.update({
      where: { user_id: userId },
      data: {
        ...(dto.full_name && { full_name: dto.full_name }),
        ...(dto.phone && { phone: dto.phone }),
      },
    });

    // Cập nhật hoặc tạo mới profile
    let updatedProfile;
    if (user.profile) {
      // Cập nhật profile hiện có
      const updateData: any = {};
      
      if (dto.dob !== undefined) updateData.dob = dto.dob ? new Date(dto.dob) : null;
      if (dto.gender !== undefined) updateData.gender = dto.gender;
      if (dto.national_id !== undefined) updateData.national_id = dto.national_id;
      if (dto.bank_account !== undefined) updateData.bank_account = dto.bank_account;
      if (dto.bank_name !== undefined) updateData.bank_name = dto.bank_name;
      if (dto.avatar_url !== undefined) updateData.avatar_url = dto.avatar_url;

      updatedProfile = await this.prisma.userProfile.update({
        where: { profile_id: user.profile.profile_id },
        data: updateData,
      });
    } else {
      // Tạo mới profile nếu chưa có
      updatedProfile = await this.prisma.userProfile.create({
        data: {
          user_id: userId,
          dob: dto.dob ? new Date(dto.dob) : null,
          gender: dto.gender || null,
          national_id: dto.national_id || null,
          bank_account: dto.bank_account || null,
          bank_name: dto.bank_name || null,
          avatar_url: dto.avatar_url || null,
          created_at: new Date(),
        },
      });
    }

    return {
      ok: true,
      message: 'Cập nhật profile thành công',
      data: {
        ...updatedUser,
        created_at: updatedUser.created_at?.toISOString(),
        profile: {
          ...updatedProfile,
          dob: updatedProfile.dob?.toISOString(),
          created_at: updatedProfile.created_at?.toISOString(),
        },
      },
    };
  }
}
