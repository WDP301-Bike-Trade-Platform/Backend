import { IsArray, IsString, ArrayNotEmpty } from 'class-validator';

export class DeleteManyMediaDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  mediaIds: string[];
}
