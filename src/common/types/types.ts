export interface RequestUser {
  user_id: string;
  email: string;
  role_id: number;
}
export interface JwtPayload {
  sub: string;
  email: string;
  role_id: number;
}
export interface JwtUser {
  user_id: string;
  email: string;
  role_id: number;
}
export type ListingWithVehicle = {
  approval_note?: string | null;
  vehicle?: {
    description?: string | null;
    frame_serial?: string | null;
  } | null;
};
