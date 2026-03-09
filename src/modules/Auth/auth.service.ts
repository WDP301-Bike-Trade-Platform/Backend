import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { OtpService } from '../../infrastructure/otp/otpSendservice';
import { JwtService } from '@nestjs/jwt';
import { ResetTokenService } from 'src/infrastructure/reset-token/reset-token.service';
import { Prisma } from '@prisma/client';
import { JwtPayload } from 'src/common/types/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private resetTokenService: ResetTokenService,
    @Inject('OtpService') private otpService: OtpService,
  ) {}

  // ==========================
  // REGISTER
  // ==========================
  async register(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const hashed = await bcrypt.hash(dto.password, 10);

    try {
      // ==== SIMPLIFIED REGISTRATION (no OTP) ====
      await this.prisma.user.create({
        data: {
          full_name: dto.full_name,
          email,
          phone: dto.phone.trim(),
          password: hashed,
          role_id: 1,
          is_verified: true,
          created_at: new Date(),
          ip_address: null,
        },
      });

      return {
        ok: true,
        message: 'Registration successful, account has been activated.',
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or phone already exists');
      }
      throw new InternalServerErrorException('Registration failed');
    }
  }

  // ==========================
  // VERIFY OTP
  // ==========================
  async verifyOtp(email: string, otp: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new BadRequestException('User does not exist');
    }

    if (user.is_verified) {
      throw new BadRequestException('Account is already verified');
    }

    const isValid = await this.otpService.verifyOtpForUser(user.user_id, otp);

    if (!isValid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { is_verified: true },
    });

    return {
      ok: true,
      message: 'OTP verified successfully',
    };
  }

  // ==========================
  // LOGIN
  // ==========================
  async login(email: string, password: string, ip: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !user.is_verified) {
      throw new BadRequestException('Invalid email or password');
    }

    // 🔐 Kiểm tra tài khoản bị khóa
    const now = new Date();
    if (user.locked_until && user.locked_until > now) {
      throw new BadRequestException(
        `Tài khoản của bạn đã bị khóa đến ${user.locked_until.toLocaleString('vi-VN')}.`,
      );
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      throw new BadRequestException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { user_id: user.user_id },
      data: { ip_address: ip },
    });

    const payload: JwtPayload = {
      sub: user.user_id,
      email: user.email,
      role_id: user.role_id,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const refresh_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '1d',
    });

    return {
      ok: true,
      access_token,
      refresh_token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role_id: user.role_id,
      },
    };
  }

  // ==========================
  // FORGOT PASSWORD
  // ==========================
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new BadRequestException('Email does not exist');
    }

    // 🔐 Kiểm tra tài khoản bị khóa
    const now = new Date();
    if (user.locked_until && user.locked_until > now) {
      throw new BadRequestException(
        'Tài khoản đang bị khóa, không thể yêu cầu đặt lại mật khẩu.',
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = this.resetTokenService.generate(user.user_id);

    // Save OTP đồng bộ (phải đợi)
    await this.otpService.saveOtpForUser(user.user_id, otp, 5 * 60);
    
    // Send email BẤT ĐỒNG BỘ - không chờ kết quả
    this.otpService.sendOtpByEmail(email, otp).catch((error) => {
      console.error('Failed to send OTP email:', error);
    });

    return {
      ok: true,
      resetToken,
      message: 'OTP sent',
    };
  }

  // ==========================
  // RESET PASSWORD
  // ==========================
  async resetPassword(resetToken: string, otp: string, newPassword: string) {
    let userId: string;

    try {
      userId = this.resetTokenService.verify(resetToken);
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // 🔐 Kiểm tra tài khoản bị khóa trước khi cho đổi mật khẩu
    const user = await this.prisma.user.findUnique({
      where: { user_id: userId },
      select: { locked_until: true },
    });

    const now = new Date();
    if (user?.locked_until && user.locked_until > now) {
      throw new BadRequestException(
        'Tài khoản đang bị khóa, không thể đổi mật khẩu.',
      );
    }

    const valid = await this.otpService.verifyOtpForUser(userId, otp);

    if (!valid) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { user_id: userId },
      data: { password: hashed },
    });

    return {
      ok: true,
      message: 'Password changed successfully',
    };
  }

  // ==========================
  // REFRESH TOKEN
  // ==========================
  async refreshToken(refreshToken: string) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new BadRequestException('Invalid refresh token');
    }

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        role_id: payload.role_id,
      },
      { expiresIn: '15m' },
    );

    return {
      ok: true,
      access_token: newAccessToken,
    };
  }
}