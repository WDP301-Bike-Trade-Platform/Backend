// shipping.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShippingDemoService } from '../Service/shipping.service';

@Injectable()
export class ShippingCron {
  constructor(private shippingService: ShippingDemoService) {}

  @Cron(CronExpression.EVERY_HOUR) // mỗi giờ chạy một lần
  async handleShipmentProgress() {
    await this.shippingService.autoProgressShipments();
  }
}
//await this.shippingService.createShipmentFromOrder(orderId);
