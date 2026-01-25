import { Module } from '@nestjs/common';
import { AuthModule } from './modules/Auth/auth.module';
import { ProductsModule } from './modules/ListingNews/product.modules';
import { CategoryModule } from './modules/Category/category.module';

@Module({
  imports: [
    AuthModule,
    CategoryModule,
    ProductsModule,
  ],
})
export class AppModule {}
