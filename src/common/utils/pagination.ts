export interface PaginationMeta {
  total: number;
  currentPage: number;
  perPage: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export async function paginate<T>(options: {
  page?: number;
  limit?: number;
  countFn: () => Promise<number>;
  dataFn: (skip: number, take: number) => Promise<T[]>;
}): Promise<PaginatedResult<T>> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? options.limit : 10;
  const skip = (page - 1) * limit;

  const [total, data] = await Promise.all([
    options.countFn(),
    options.dataFn(skip, limit),
  ]);

  return {
    data,
    pagination: {
      total,
      currentPage: page,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
