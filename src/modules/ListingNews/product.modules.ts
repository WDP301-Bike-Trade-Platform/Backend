import { Module } from '@nestjs/common';
import { ProductsController } from './Controller/products.controller';
import { PrismaService } from 'src/database/prisma.service';
import { CreateListingService } from './Service/createListing.service';
import { GetListingService } from './Service/getListing.service';
import { UpdateListingService } from './Service/updateListing.service';
import { AdminListingController } from './Controller/adminListing.controller';
import { ChangeListingStatusService } from './Service/sellerListingStatus.service';
import { AdminListingService } from './Service/adminApprovedListing.service';
import { ListingExpirationCron } from './cron/listing-expiration.cron';
import { ListingMediaService } from './Service/listingMediaService';
import { ListingMediaController } from './Controller/listing-media.controller';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    ProductsController,
    ListingMediaController,
    AdminListingController,
  ],
  providers: [
    GetListingService,
    CreateListingService,
    UpdateListingService,
    ChangeListingStatusService,
    ListingMediaService,
    AdminListingService,
    ListingExpirationCron,
    PrismaService,
  ],
})
export class ProductsModule {}
