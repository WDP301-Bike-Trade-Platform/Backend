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
import { TransferModule } from './modules/Transfer/transfer.module';
import { NotificationModule } from './modules/Notification/notification.module';
import { ChatModule } from './modules/Chat/chat.module';
import { ConfigModule } from '@nestjs/config';
import { WishlistModule } from './modules/Wishlist/wishlist.module';

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
    TransferModule,
    NotificationModule,
    ChatModule,
    WishlistModule,
  ],
})
export class AppModule {}
