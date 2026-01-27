import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../database/prisma.service';
import { OtpDbService } from '../../infrastructure/otp/otpSend.service';
import { ResetTokenService } from 'src/infrastructure/reset-token/reset-token.service';
import { JwtStrategy } from '../../common/auth/jwt.strategy';
import { JwtAuthGuard } from '../../common/auth/jwt.guard';

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
    JwtStrategy,
    JwtAuthGuard,
    { provide: 'OtpService', useClass: OtpDbService },
  ],
  exports: [AuthService, JwtModule, JwtAuthGuard, PassportModule],
})
export class AuthModule {}
