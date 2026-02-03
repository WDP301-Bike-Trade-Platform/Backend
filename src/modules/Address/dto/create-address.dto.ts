import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';

export class CreateAddressDto {
  @ApiPropertyOptional({ description: 'Nhãn địa chỉ (VD: Nhà riêng, Văn phòng)' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Tên người nhận' })
  @IsOptional()
  @IsString()
  recipient_name?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại người nhận' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Địa chỉ dòng 1' })
  @IsNotEmpty()
  @IsString()
  address_line1: string;

  @ApiPropertyOptional({ description: 'Địa chỉ dòng 2' })
  @IsOptional()
  @IsString()
  address_line2?: string;

  @ApiPropertyOptional({ description: 'Phường/Xã' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiPropertyOptional({ description: 'Quận/Huyện' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: 'Thành phố/Tỉnh' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Mã bưu điện' })
  @IsOptional()
  @IsString()
  postal_code?: string;

  @ApiPropertyOptional({ description: 'Quốc gia', default: 'Vietnam' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Đặt làm địa chỉ mặc định', default: false })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
