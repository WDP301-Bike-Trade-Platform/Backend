import { BadRequestException, ConflictException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { OtpService } from '../../infrastructure/otp/otpSendservice';
import { JwtService } from '@nestjs/jwt';
import { ResetTokenService } from 'src/infrastructure/reset-token/reset-token.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private resetTokenService: ResetTokenService,
    @Inject('OtpService') private otpService: OtpService,
  ) {}

  async register(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const hashed = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          full_name: dto.full_name,
          email,
          phone: dto.phone.trim(),
          password: hashed,
          role_id: 1,
          is_verified: false,
          created_at: new Date(),
          ip_address: null,
        },
      });

      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      await this.otpService.saveOtpForUser(user.user_id, otp, 5 * 60);
      await this.otpService.sendOtpByEmail(email, otp);

      return {
        ok: true,
        message: 'OTP đã gửi. Vui lòng xác nhận tài khoản.',
      };
    } catch (error) {
      if ((error as any)?.code === 'P2002') {
        throw new ConflictException('Email/phone đã tồn tại');
      }
      throw new InternalServerErrorException('Lỗi khi đăng ký');
    }
  }
  async verifyOtp(email: string, otp: string) {
  const user = await this.prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new BadRequestException('User không tồn tại');
  }

  if (user.is_verified) {
    throw new BadRequestException('Tài khoản đã được xác nhận');
  }

  const isValid = await this.otpService.verifyOtpForUser(
    user.user_id,
    otp,
  );

  if (!isValid) {
    throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
  }

  await this.prisma.user.update({
    where: { user_id: user.user_id },
    data: { is_verified: true },
  });

  return {
    ok: true,
    message: 'Xác nhận OTP thành công',
  };
  }
    async login(email: string, password: string, ip: string) {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user || !user.is_verified) {
        throw new BadRequestException('Sai email hoặc mật khẩu');
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        throw new BadRequestException('Sai email hoặc mật khẩu');
      }

      // ✅ update IP mỗi lần login
      await this.prisma.user.update({
        where: { user_id: user.user_id },
        data: {
          ip_address: ip,
        },
      });

      const payload = {
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



  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new BadRequestException('Email không tồn tại');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const resetToken = this.resetTokenService.generate(user.user_id);

    await this.otpService.saveOtpForUser(user.user_id, otp, 5 * 60);
    await this.otpService.sendOtpByEmail(email, otp);

    return {
      ok: true,
      resetToken,
      message: 'OTP đã gửi',
    };
  }


  async resetPassword(
    resetToken: string,
    otp: string,
    newPassword: string,
  ) {
    let userId: string;

    // 1️⃣ verify reset token
    try {
      userId = this.resetTokenService.verify(resetToken);
    } catch {
      throw new BadRequestException(
        'Reset token không hợp lệ hoặc đã hết hạn',
      );
    }

    // 2️⃣ verify OTP theo user_id
    const valid = await this.otpService.verifyOtpForUser(
      userId,
      otp,
    );

    if (!valid) {
      throw new BadRequestException('OTP không hợp lệ hoặc đã hết hạn');
    }

    // 3️⃣ update password
    const hashed = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { user_id: userId },
      data: { password: hashed },
    });

    return {
      ok: true,
      message: 'Đổi mật khẩu thành công',
    };
  }
  async refreshToken(refreshToken: string) {
  let payload: any;

  try {
    payload = await this.jwtService.verifyAsync(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
  } catch {
    throw new BadRequestException('Refresh token không hợp lệ');
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