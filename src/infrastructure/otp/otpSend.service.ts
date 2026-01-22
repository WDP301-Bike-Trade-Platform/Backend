import { Injectable, Logger } from '@nestjs/common';
import { OtpService } from '../../infrastructure/otp/otpSendservice';
import { PrismaService } from '../../database/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class OtpDbService extends OtpService {
  private readonly logger = new Logger(OtpDbService.name);

  constructor(private prisma: PrismaService) {
    super();
  }


  async saveOtpForUser(
    userId: string,
    otp: string,
    ttlSeconds: number,
  ): Promise<void> {
    const expiredAt = new Date(Date.now() + ttlSeconds * 1000);

    // xoá OTP cũ nếu tồn tại
    await this.prisma.otp.deleteMany({
      where: { user_id: userId },
    });

    await this.prisma.otp.create({
      data: {
        user_id: userId,
        code: otp,
        expired_at: expiredAt,
      },
    });
  }

  // 👉 Verify OTP
  async verifyOtpForUser(
    userId: string,
    otp: string,
  ): Promise<boolean> {
    const record = await this.prisma.otp.findFirst({
      where: {
        user_id: userId,
        code: otp,
      },
    });

    if (!record) {
      this.logger.warn(`OTP not found for user ${userId}`);
      return false;
    }

    if (record.expired_at < new Date()) {
      this.logger.warn(`OTP expired for user ${userId}`);
      return false;
    }

    // OTP hợp lệ → xoá
    await this.prisma.otp.delete({
      where: { id: record.id },
    });

    return true;
  }

  // 👉 Gửi OTP qua email
  async sendOtpByEmail(email: string, otp: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"MyApp Security" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Xác nhận OTP của bạn',
      html: `
      <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px 0">
        <div style="max-width:480px; margin:auto; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.08)">
          
          <h2 style="text-align:center; color:#111827; margin-bottom:8px">
            Xác nhận OTP
          </h2>

          <p style="text-align:center; color:#6b7280; font-size:14px; margin-bottom:32px">
            Mã xác nhận của bạn có hiệu lực trong <b>5 phút</b>
          </p>

          <div style="
            background:#f3f4f6;
            border-radius:10px;
            padding:20px;
            text-align:center;
            font-size:32px;
            letter-spacing:6px;
            font-weight:bold;
            color:#111827;
            margin-bottom:24px;
          ">
            ${otp}
          </div>

          <p style="font-size:14px; color:#374151; line-height:1.6">
            Nếu bạn <b>không yêu cầu</b> mã này, hãy bỏ qua email này.
          </p>

          <hr style="margin:32px 0; border:none; border-top:1px solid #e5e7eb" />

          <p style="font-size:12px; color:#9ca3af; text-align:center">
            © ${new Date().getFullYear()} MyApp. All rights reserved.
          </p>

        </div>
      </div>
      `,
    });

  }
}

