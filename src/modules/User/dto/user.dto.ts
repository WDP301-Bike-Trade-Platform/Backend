export class UserDto {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role_id: number;
  is_verified: boolean;
  violation_count: number;
  locked_until: Date | null;
  created_at: Date;
  profile?: UserProfileDto;
}

export class UserProfileDto {
  profile_id: string;
  dob: Date | null;
  gender: string | null;
  national_id: string | null;
  bank_account: string | null;
  bank_name: string | null;
  avatar_url: string | null;
  created_at: Date;
}
