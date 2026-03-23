import { Module } from '@nestjs/common';
import { OfferController } from './Controller/offer.controller';
import { OfferService } from './Service/offer.service';
import { PrismaService } from 'src/database/prisma.service';
import { NotificationModule } from '../Notification/notification.module';
import { AuthModule } from '../Auth/auth.module';

@Module({
  imports: [NotificationModule, AuthModule],
  controllers: [OfferController],
  providers: [OfferService, PrismaService],
  exports: [OfferService],
})
export class OfferModule { }
