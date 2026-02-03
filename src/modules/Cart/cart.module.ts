import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
