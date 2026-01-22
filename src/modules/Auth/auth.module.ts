import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from '../../database/prisma.service';
import { OtpDbService } from '../../infrastructure/otp/otpSend.service';
import { ResetTokenService } from 'src/infrastructure/reset-token/reset-token.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    ResetTokenService,
    { provide: 'OtpService', useClass: OtpDbService },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
