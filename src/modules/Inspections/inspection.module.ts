import { Module } from '@nestjs/common';

import { AuthModule } from '../Auth/auth.module'; // Adjust path as needed
import { InspectionController } from './Controller/inspection.controller';
import { PrismaService } from 'src/database/prisma.service';
import { InspectionService } from './Service/inspection.service';


@Module({
  imports: [AuthModule], // Cung cấp JwtAuthGuard và CurrentUser decorator
  controllers: [InspectionController],
  providers: [InspectionService, PrismaService],
})
export class InspectionModule {}