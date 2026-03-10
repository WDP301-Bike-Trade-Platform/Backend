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
  async verifyOtpForUser(userId: string, otp: string): Promise<boolean> {
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

  // 👉 Gửi OTP qua email với timeout
  async sendOtpByEmail(email: string, otp: string): Promise<void> {
    try {
      const transporter = nodemailer.createTransport({
        pool: true,
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
        maxConnections: 5, // Số lượng kết nối tối đa được giữ lại
        maxMessages: 100,
        // Thêm timeout để tránh block quá lâu
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 10000, // 10 seconds
      });

      // Set timeout cho toàn bộ operation
      const sendMailPromise = transporter.sendMail({
        from: `"MyApp Security" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your OTP Verification Code',
        html: `
      <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:40px 0">
        <div style="max-width:480px; margin:auto; background:#ffffff; border-radius:12px; padding:32px; box-shadow:0 10px 30px rgba(0,0,0,0.08)">
          
          <h2 style="text-align:center; color:#111827; margin-bottom:8px">
            OTP Verification
          </h2>

          <p style="text-align:center; color:#6b7280; font-size:14px; margin-bottom:32px">
            Your verification code is valid for <b>5 minutes</b>
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
            If you <b>did not request</b> this code, please ignore this email.
          </p>

          <hr style="margin:32px 0; border:none; border-top:1px solid #e5e7eb" />

          <p style="font-size:12px; color:#9ca3af; text-align:center">
            © ${new Date().getFullYear()} MyApp. All rights reserved.
          </p>

        </div>
      </div>
      `,
      });

      // Race với timeout 15 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout')), 30000),
      );

      await Promise.race([sendMailPromise, timeoutPromise]);
      
      this.logger.log(`✅ OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send OTP email to ${email}:`, error);
      throw error; // Re-throw để caller có thể catch và log
    }
  }
}
