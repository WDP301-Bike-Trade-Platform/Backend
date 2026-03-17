import { Module, forwardRef } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { AdminOrderService } from './admin-order.service';
import { AdminOrderController } from './admin-order.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from '../Auth/auth.module';
import { CartModule } from '../Cart/cart.module';
import { NotificationModule } from '../Notification/notification.module';
import { ShippingModule } from '../Shipping/shipping.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    forwardRef(() => CartModule),
    forwardRef(() => ShippingModule),
    NotificationModule,
  ],
  controllers: [OrderController, AdminOrderController],
  providers: [OrderService, AdminOrderService],
  exports: [OrderService, AdminOrderService],
})
export class OrderModule {}
