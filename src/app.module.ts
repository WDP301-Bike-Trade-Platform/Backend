import { Module } from '@nestjs/common';
import { AuthModule } from './modules/Auth/auth.module';
import { ProductsModule } from './modules/ListingNews/product.modules';
import { CategoryModule } from './modules/Category/category.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './modules/User/user.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    CategoryModule,
    ProductsModule,
    UserModule,
  ],
})
export class AppModule {}
