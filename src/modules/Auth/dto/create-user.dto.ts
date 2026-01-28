import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MaxLength(255)
  full_name: string;

  @ApiProperty({ example: 'a@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '0901234567' })
  @Matches(/^(0|(?:\+84))(3|5|7|8|9)([0-9]{8})$/, { message: 'Số điện thoại không hợp lệ' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'P@ssw0rd' })
  @IsString()
  @MinLength(6)
  password: string;
}
