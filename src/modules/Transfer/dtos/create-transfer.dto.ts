import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ArrayMinSize,
  IsInt,
  Min,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: 1500000, description: 'Số tiền cần chuyển (đơn vị VNĐ)' })
  @IsInt()
  @Min(1000)
  amount: number;

  @ApiProperty({ example: 'Thanh toán hoa hồng tháng 3' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '970415', description: 'BIN của ngân hàng đích' })
  @IsString()
  @IsNotEmpty()
  toBin: string;

  @ApiProperty({ example: '0123456789', description: 'Số tài khoản người nhận' })
  @IsString()
  @IsNotEmpty()
  toAccountNumber: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['commission', 'march-2026'],
    description: 'Các tag phục vụ phân loại payout',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  category?: string[];
}
