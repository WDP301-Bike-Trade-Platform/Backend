import { Module } from '@nestjs/common';

import { AuthModule } from '../Auth/auth.module'; // Adjust path as needed
import { WishlistController } from './controller/wishlist.controller';
import { WishlistService } from './service/wishlist.service';
import { PrismaService } from 'src/database/prisma.service';

@Module({
  imports: [AuthModule], // Cung cấp JwtAuthGuard và CurrentUser decorator
  controllers: [WishlistController],
  providers: [WishlistService, PrismaService],
})
export class WishlistModule {}