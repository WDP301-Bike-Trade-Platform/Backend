import { Module } from '@nestjs/common';
import { AuthModule } from './modules/Auth/auth.module';
import { ProductsModule } from './modules/ListingNews/product.modules';
import { CategoryModule } from './modules/Category/category.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    CategoryModule,
    ProductsModule,
  ],
})
export class AppModule {}
