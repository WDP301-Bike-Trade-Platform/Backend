import { Module } from '@nestjs/common';

import { AuthModule } from '../Auth/auth.module'; // Adjust path as needed
import { ShippingController } from './Controller/shipping.controller';
import { ShippingDemoService } from './Service/shipping.service';
import { PrismaService } from 'src/database/prisma.service';
import { ShippingCron } from './Crons/shipping.cron';
import { NotificationModule } from '../Notification/notification.module';


@Module({
  imports: [AuthModule,NotificationModule], // Cung cấp JwtAuthGuard và CurrentUser decorator
  controllers: [ShippingController],
  providers: [ShippingDemoService, PrismaService,ShippingCron],
    exports: [ShippingDemoService], // 👈 thêm dòng này

})
export class ShippingModule {}