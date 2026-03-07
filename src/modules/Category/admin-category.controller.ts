import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto, CategoryQueryDto } from './DTOs/category.dto';
@ApiTags('Admin Categories')
@ApiBearerAuth('access-token')
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(3) // ADMIN
export class AdminCategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo danh mục mới' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục (mặc định dạng cây)' })
  async findAll(@Query() query: CategoryQueryDto) {
    query.tree = query.tree ?? true; // Admin mặc định xem dạng cây
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết danh mục' })
  async findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật danh mục' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa danh mục (chỉ khi không có con)' })
  async remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }
}