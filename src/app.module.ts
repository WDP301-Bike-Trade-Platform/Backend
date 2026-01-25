import { Module } from '@nestjs/common';
import { AuthModule } from './modules/Auth/auth.module';
import { ProductsModule } from './modules/Seller/product.modules';

@Module({
  imports: [
    AuthModule,
    ProductsModule,
  ],
})
export class AppModule {}
