import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { MediaType } from '@prisma/client';

export class AddMediaItemDto {
  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @IsNumber()
  size_bytes: number; // FE gửi number, service cast -> BigInt

  @IsEnum(MediaType)
  media_type: MediaType;
}

export class AddMediaDto {
  @IsArray()
  @ValidateNested({ each: true })
  files: AddMediaItemDto[];
}
