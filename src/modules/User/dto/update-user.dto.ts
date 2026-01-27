import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    description: 'Họ và tên đầy đủ của người dùng',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({
    description: 'Số điện thoại',
    example: '0987654321',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Ngày sinh (ISO 8601 format)',
    example: '1990-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiProperty({
    description: 'Giới tính',
    example: 'Male',
    enum: ['Male', 'Female', 'Other'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['Male', 'Female', 'Other'])
  gender?: string;

  @ApiProperty({
    description: 'Số chứng minh nhân dân / Căn cước công dân',
    example: '001234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  national_id?: string;

  @ApiProperty({
    description: 'Số tài khoản ngân hàng',
    example: '1234567890123',
    required: false,
  })
  @IsOptional()
  @IsString()
  bank_account?: string;

  @ApiProperty({
    description: 'Tên ngân hàng',
    example: 'Vietcombank',
    required: false,
  })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiProperty({
    description: 'URL ảnh đại diện',
    example: 'https://example.com/avatars/user123.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatar_url?: string;
}
