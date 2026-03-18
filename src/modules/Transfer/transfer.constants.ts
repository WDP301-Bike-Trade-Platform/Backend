export const ADMIN_TRANSFER_RELATIONS = {
  transactions: { orderBy: { created_at: 'asc' as const } },
  order: {
    include: {
      buyer: {
        select: { user_id: true, full_name: true, email: true, phone: true },
      },
      listing: {
        include: {
          vehicle: true,
          seller: {
            select: { user_id: true, full_name: true, email: true, phone: true },
          },
        },
      },
      orderDetails: true,
    },
  },
  user: {
    select: { user_id: true, full_name: true, email: true, phone: true },
  },
} as const;
