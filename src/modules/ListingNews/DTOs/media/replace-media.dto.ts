import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class ReplaceMediaDto {
  @IsString()
  @IsNotEmpty()
  file_url: string;

  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @IsNumber()
  size_bytes: number;
}
