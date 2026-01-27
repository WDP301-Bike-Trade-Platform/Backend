import { IsArray, IsInt, IsString } from 'class-validator';

export class ReorderMediaItemDto {
  @IsString()
  media_id: string;

  @IsInt()
  position: number;
}

export class ReorderMediaDto {
  @IsArray()
  orders: ReorderMediaItemDto[];
}
