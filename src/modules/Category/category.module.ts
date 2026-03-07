import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { PrismaService } from 'src/database/prisma.service';
import { AuthModule } from '../Auth/auth.module';
import { AdminCategoryController } from './admin-category.controller';

@Module({
  imports: [AuthModule],
  controllers: [CategoryController,AdminCategoryController],
  providers: [CategoryService, PrismaService],
})
export class CategoryModule {}
