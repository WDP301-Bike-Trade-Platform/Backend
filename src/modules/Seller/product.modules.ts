import { Module } from '@nestjs/common';
import { ProductsController } from './Controller/products.controller';
import { ProductsService } from './Service/products.service';
import { PrismaService } from 'src/database/prisma.service';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [
    AuthModule, // để dùng JwtStrategy + JwtAuthGuard
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    PrismaService,
  ],
})
export class ProductsModule {}
