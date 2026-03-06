import { Module } from '@nestjs/common';

import { AuthModule } from '../Auth/auth.module'; // Adjust path as needed
import { PrismaService } from 'src/database/prisma.service';
import { ReportController } from './Controller/report.controller';
import { ReportService } from './Service/report.service';


@Module({
  imports: [AuthModule], // Cung cấp JwtAuthGuard và CurrentUser decorator
  controllers: [ReportController],
  providers: [ReportService, PrismaService],
})
export class ReportModule {}