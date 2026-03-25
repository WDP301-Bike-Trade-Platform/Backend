import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { ProductSearchQuery } from "../DTOs/search/product-search.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) { }

  async search(query: ProductSearchQuery) {
    const { keyword, category, price_range, location, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Khởi tạo where clause: lấy các listing có trạng thái ACTIVE hoặc APPROVED
    const where: Prisma.ListingWhereInput = {
      status: { in: ['ACTIVE', 'APPROVED'] },
    };

    // Xây dựng filter cho vehicle (các điều kiện liên quan đến xe)
    let vehicleFilter: Prisma.VehicleWhereInput = {};

    // 1. Tìm kiếm theo keyword
    if (keyword) {
      vehicleFilter = {
        OR: [
          { brand: { contains: keyword, mode: 'insensitive' } },
          { model: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          {
            category: {
              name: { contains: keyword, mode: 'insensitive' },
            },
          },
        ],
      };
    }

    // 2. Lọc theo category
    if (category) {
      vehicleFilter = {
        ...vehicleFilter,
        category_id: category,
      };
    }

    // 3. Lọc theo khoảng giá
    if (price_range) {
      // Kiểm tra định dạng "min-max"
      const parts = price_range.split('-');
      if (parts.length !== 2) {
        throw new BadRequestException('price_range must be in "min-max" format');
      }
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (isNaN(min) || isNaN(max)) {
        throw new BadRequestException('Min and max values must be numbers');
      }
      const priceFilter: Prisma.DecimalFilter = {};
      if (min >= 0) priceFilter.gte = min;
      if (max >= 0) priceFilter.lte = max;

      vehicleFilter = {
        ...vehicleFilter,
        price: priceFilter,
      };
    }

    // Gán vehicleFilter vào where nếu có điều kiện
    if (Object.keys(vehicleFilter).length > 0) {
      where.vehicle = vehicleFilter;
    }

    // 4. Lọc theo địa điểm (thành phố của người bán)
    if (location) {
      where.seller = {
        addresses: {
          some: {
            city: { contains: location, mode: 'insensitive' },
          },
        },
      };
    }

    // Thực hiện truy vấn đồng thời count và findMany
    const [total, items] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where,
        include: {
          vehicle: {
            include: {
              category: true,
            },
          },
          seller: {
            include: {
              profile: true, // lấy avatar
              addresses: {
                where: { is_default: true },
                take: 1,
              },
            },
          },
          media: {
            where: { is_cover: true },
            take: 1,
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    // Map dữ liệu trả về (có thể điều chỉnh để lấy nhiều thông tin hơn nếu cần)
    const products = items.map((listing) => ({
      id: listing.listing_id,
      title: `${listing.vehicle.brand} ${listing.vehicle.model} ${listing.vehicle.year}`,
      price: listing.vehicle.price, // Prisma.Decimal trả về dạng { s, e, d }
      condition: listing.vehicle.condition,
      mileage_km: listing.vehicle.mileage_km,
      description: listing.vehicle.description,
      category: listing.vehicle.category.name,
      seller: {
        id: listing.seller.user_id,
        name: listing.seller.full_name,
        avatar: listing.seller.profile?.avatar_url || null,
        location: listing.seller.addresses[0]?.city || null,
      },
      cover_image: listing.media[0]?.file_url || null,
      created_at: listing.created_at,
    }));

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}