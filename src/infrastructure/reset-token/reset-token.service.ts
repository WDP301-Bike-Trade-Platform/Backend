// infrastructure/reset-token/reset-token.service.ts
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ResetTokenService {
  private readonly secret = process.env.RESET_TOKEN_SECRET!;
  private readonly expiresIn = '10m';

  generate(userId: string) {
    return jwt.sign({ sub: userId }, this.secret, {
      expiresIn: this.expiresIn,
    });
  }

  verify(token: string): string {
    const payload = jwt.verify(token, this.secret) as any;
    return payload.sub;
  }
}
