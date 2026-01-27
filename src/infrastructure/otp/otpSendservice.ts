export abstract class OtpService {
  abstract saveOtpForUser(
    userId: string,
    otp: string,
    ttlSeconds: number,
  ): Promise<void>;
  abstract verifyOtpForUser(userId: string, otp: string): Promise<boolean>;
  abstract sendOtpByEmail(email: string, otp: string): Promise<void>;
}
