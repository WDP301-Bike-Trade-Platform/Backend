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
    description: 'Full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({
    description: 'Phone number',
    example: '0987654321',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Date of birth (ISO 8601 format)',
    example: '1990-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiProperty({
    description: 'Gender',
    example: 'Male',
    enum: ['Male', 'Female', 'Other'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['Male', 'Female', 'Other'])
  gender?: string;

  @ApiProperty({
    description: 'National ID / Citizen ID',
    example: '001234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  national_id?: string;

  @ApiProperty({
    description: 'Bank account number',
    example: '1234567890123',
    required: false,
  })
  @IsOptional()
  @IsString()
  bank_account?: string;

  @ApiProperty({
    description: 'Bank name',
    example: 'Vietcombank',
    required: false,
  })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiProperty({
    description: 'Bank BIN code',
    example: '970436',
    required: false,
  })
  @IsOptional()
  @IsString()
  bank_bin?: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatars/user123.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatar_url?: string;
}
