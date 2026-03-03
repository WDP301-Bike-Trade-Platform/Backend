import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransferDto } from './create-transfer.dto';

export class CreateBatchTransferDto {
  @ApiProperty({ type: [CreateTransferDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTransferDto)
  transfers: CreateTransferDto[];
}
