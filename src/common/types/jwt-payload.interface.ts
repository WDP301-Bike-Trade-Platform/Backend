// src/common/auth/jwt-payload.interface.ts
export interface JwtPayload {
  sub: string;
  email: string;
  role_id: number;
}
