import { Module } from '@nestjs/common';
import { AuthModule } from './modules/Auth/auth.module';
import { ProductsModule } from './modules/ListingNews/product.modules';
import { CategoryModule } from './modules/Category/category.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './modules/User/user.module';
import { PaymentModule } from './modules/Payment/payment.module';
import { OrderModule } from './modules/Order/order.module';
import { CartModule } from './modules/Cart/cart.module';
import { AddressModule } from './modules/Address/address.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    CategoryModule,
    ProductsModule,
    UserModule,
    PaymentModule,
    OrderModule,
    CartModule,
    AddressModule,
  ],
})
export class AppModule {}
