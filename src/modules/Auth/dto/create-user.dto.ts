import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MaxLength(255)
  full_name: string;

  @ApiProperty({ example: 'a@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+84901234567' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  @MinLength(6)
  password: string;
}
