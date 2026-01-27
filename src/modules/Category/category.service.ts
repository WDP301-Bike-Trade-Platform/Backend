import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { paginate } from 'src/common/utils/pagination';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number) {
    return paginate({
      page,
      limit: 10,
      countFn: () => this.prisma.category.count(),
      dataFn: (skip, take) =>
        this.prisma.category.findMany({
          skip,
          take,
          orderBy: { name: 'asc' },
        }),
    });
  }
}
