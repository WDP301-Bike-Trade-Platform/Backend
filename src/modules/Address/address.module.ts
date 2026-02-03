import { Module } from '@nestjs/common';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
