import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination';
import { Category } from '@prisma/client';
import { CategoryQueryDto, CreateCategoryDto, UpdateCategoryDto } from './DTOs/category.dto';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Admin CRUD ----------

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { category_id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('Danh mục cha không tồn tại');
      }
    }

    return this.prisma.category.create({
      data: {
        name: dto.name,
        parent_id: dto.parentId,
      },
    });
  }

  async findAll(query: CategoryQueryDto) {
    const { parentId, tree, page, limit } = query;

    // Xây dựng điều kiện lọc
    const where: any = {};
    if (parentId !== undefined) {
      where.parent_id = parentId === 'null' ? null : parentId;
    }

    if (!tree) {
      // Trả về phân trang phẳng
      return paginate({
        page,
        limit,
        countFn: () => this.prisma.category.count({ where }),
        dataFn: (skip, take) =>
          this.prisma.category.findMany({
            where,
            skip,
            take,
            orderBy: { name: 'asc' },
          }),
      });
    } else {
      // Trả về dạng cây (không phân trang, lấy tất cả)
      const allCategories = await this.prisma.category.findMany({
        orderBy: { name: 'asc' },
      });
      const treeData = this.buildTree(allCategories, parentId === 'null' ? null : parentId ?? null);
      return {
        data: treeData,
        meta: {
          total: treeData.length,
          page: 1,
          limit: treeData.length,
          totalPages: 1,
        },
      };
    }
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { category_id: id },
      include: { children: true },
    });
    if (!category) {
      throw new NotFoundException('Danh mục không tồn tại');
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { category_id: id },
    });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');

    // Kiểm tra parentId hợp lệ nếu có thay đổi
    if (dto.parentId !== undefined) {
      if (dto.parentId !== null) {
        const parent = await this.prisma.category.findUnique({
          where: { category_id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException('Danh mục cha không tồn tại');
        }
        // Kiểm tra không tạo vòng lặp
        if (await this.isDescendant(id, dto.parentId)) {
          throw new BadRequestException('Không thể đặt danh mục cha là con của chính nó');
        }
      }
    }

    return this.prisma.category.update({
      where: { category_id: id },
      data: {
        name: dto.name,
        parent_id: dto.parentId,
      },
    });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { category_id: id },
      include: { children: true },
    });
    if (!category) throw new NotFoundException('Danh mục không tồn tại');
    if (category.children.length > 0) {
      throw new ConflictException('Không thể xóa danh mục có chứa danh mục con');
    }

    return this.prisma.category.delete({
      where: { category_id: id },
    });
  }

  // ---------- Helper functions ----------

  private async isDescendant(categoryId: string, descendantId: string): Promise<boolean> {
    if (categoryId === descendantId) return true;

    const children = await this.prisma.category.findMany({
      where: { parent_id: categoryId },
      select: { category_id: true },
    });

    for (const child of children) {
      if (await this.isDescendant(child.category_id, descendantId)) {
        return true;
      }
    }
    return false;
  }

  private buildTree(categories: Category[], rootParentId: string | null = null): any[] {
    const map = new Map<string, any>();
    const roots: any[] = [];

    categories.forEach(cat => {
      map.set(cat.category_id, { ...cat, children: [] });
    });

    categories.forEach(cat => {
      const node = map.get(cat.category_id);
      if (cat.parent_id && map.has(cat.parent_id)) {
        const parent = map.get(cat.parent_id);
        parent.children.push(node);
      } else if (cat.parent_id === rootParentId || (rootParentId === null && !cat.parent_id)) {
        roots.push(node);
      }
    });

    return roots;
  }
}