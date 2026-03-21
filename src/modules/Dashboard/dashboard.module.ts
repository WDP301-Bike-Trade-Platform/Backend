// src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../Auth/auth.module';
import { HttpModule } from '@nestjs/axios';
import { DashboardController } from './Controller/dashboard.controller';
import { DashboardService } from './Service/dashboard.service';
@Module({
  imports: [AuthModule, HttpModule,],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}