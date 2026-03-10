import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { CategoryQueryDto } from './DTOs/category.dto';

@ApiTags('Categories')
@Controller('categories')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) { }

  @Get()
  @Public()
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'parentId', required: false, description: 'Lọc theo cha (UUID hoặc "null")' })
  @ApiQuery({ name: 'tree', required: false, description: 'Trả về dạng cây?', example: false })
  async getCategories(@Query() query: CategoryQueryDto) {
    // Đặt tree mặc định là false cho public (trả về phẳng)
    query.tree = query.tree ?? false;
    return this.categoryService.findAll(query);
  }
}