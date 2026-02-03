import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../Auth/auth.module';
import { CartModule } from '../Cart/cart.module';

@Module({
  imports: [DatabaseModule, AuthModule, forwardRef(() => CartModule)],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
