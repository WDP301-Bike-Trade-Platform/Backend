import { Module } from '@nestjs/common';
import { ProductsController } from './Controller/products.controller';
import { PrismaService } from 'src/database/prisma.service';
import { CreateListingService } from './Service/createListing.service';
import { GetListingService } from './Service/getListing.service';

@Module({
  controllers: [ProductsController],
  providers: [
    GetListingService,
    CreateListingService,
    PrismaService,
  ],
})
export class ProductsModule {}
