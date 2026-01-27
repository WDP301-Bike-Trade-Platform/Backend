import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SellerListingAction {
  SHOW = 'SHOW',
  HIDE = 'HIDE',
  MARK_SOLD = 'MARK_SOLD',
}

export class ChangeListingStatusDto {
  @ApiProperty({
    enum: SellerListingAction,
    example: SellerListingAction.HIDE,
  })
  @IsEnum(SellerListingAction)
  action: SellerListingAction;
}
