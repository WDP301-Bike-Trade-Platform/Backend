import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../database/prisma.service';
import { OtpDbService } from '../../infrastructure/otp/otpSend.service';
import { ResetTokenService } from 'src/infrastructure/reset-token/reset-token.service';
import { JwtStrategy } from '../../common/auth/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    ResetTokenService,
    JwtStrategy, // 👈 BẮT BUỘC
    { provide: 'OtpService', useClass: OtpDbService },
  ],
  exports: [
    AuthService,
    JwtModule,
    PassportModule, // 👈 để module khác dùng Guard
  ],
})
export class AuthModule {}
