// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Tạo role AI_ASSISTANT nếu chưa có
  const aiRole = await prisma.role.upsert({
    where: { role_name: 'AI_ASSISTANT' },
    update: {},
    create: { role_name: 'AI_ASSISTANT' },
  });
  console.log('AI_ASSISTANT role ensured');

  // 2. Tạo user bot
  const botUser = await prisma.user.upsert({
    where: { user_id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      user_id: '00000000-0000-0000-0000-000000000001',
      full_name: 'AI Assistant',
      email: 'ai-assistant@example.com',
      phone: '0000000000',
      password: '', // không dùng để đăng nhập
      role_id: aiRole.role_id,
      created_at: new Date(),
      is_verified: true,
    },
  });
  console.log('AI Assistant user created');

  // 3. Tạo user thường
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      full_name: 'Test User',
      email: 'test@example.com',
      phone: '0987654321',
      password: '$2b$10$...', // mã hóa mật khẩu "123456" (bạn thay bằng hash thật nếu cần)
      role_id: 1, // USER role (giả sử role_id=1)
      created_at: new Date(),
      is_verified: true,
    },
  });
  console.log('Test user created');

  // 4. Tạo danh mục (nếu chưa)
  const category = await prisma.category.upsert({
    where: { category_id: 'cat-bike' },
    update: {},
    create: {
      category_id: 'cat-bike',
      name: 'Xe đạp',
    },
  });
  console.log('Category created');

  // 5. Tạo các xe (Vehicle) với mô tả đa dạng
  const vehicles = await Promise.all([
    prisma.vehicle.create({
      data: {
        vehicle_id: 'veh-001',
        category_id: category.category_id,
        brand: 'Giant',
        model: 'Talon 29',
        year: 2023,
        price: 12500000,
        bike_type: 'mtb',
        material: 'aluminum',
        brake_type: 'disc',
        wheel_size: '29',
        condition: 'USED',
        usage_level: 'LIGHT',
        mileage_km: 500,
        description: 'Xe đạp địa hình Giant Talon 29, khung nhôm, phanh đĩa, lốp 29 inch. Xe đã sử dụng nhẹ, chạy 500km, còn rất mới.',
      },
    }),
    prisma.vehicle.create({
      data: {
        vehicle_id: 'veh-002',
        category_id: category.category_id,
        brand: 'Trek',
        model: 'FX 3',
        year: 2024,
        price: 9500000,
        bike_type: 'road',
        material: 'carbon',
        brake_type: 'rim',
        wheel_size: '700c',
        condition: 'NEW',
        description: 'Xe đạp đường trường Trek FX 3, khung carbon nhẹ, phanh vành, lốp 700c. Xe mới 100%, chưa qua sử dụng.',
      },
    }),
    prisma.vehicle.create({
      data: {
        vehicle_id: 'veh-003',
        category_id: category.category_id,
        brand: 'Honda',
        model: 'Vision',
        year: 2022,
        price: 28000000,
        bike_type: 'scooter',
        material: 'steel',
        brake_type: 'disc',
        wheel_size: '14',
        condition: 'USED',
        usage_level: 'HEAVY',
        mileage_km: 15000,
        description: 'Xe máy Honda Vision 2022, màu đỏ, đã chạy 15000km, xe chính chủ, giấy tờ đầy đủ.',
      },
    }),
  ]);
  console.log('Vehicles created');

  // 6. Tạo các listing cho từng xe
  const listings = await Promise.all([
    prisma.listing.create({
      data: {
        listing_id: 'listing-001',
        seller_id: user.user_id,
        vehicle_id: vehicles[0].vehicle_id,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.listing.create({
      data: {
        listing_id: 'listing-002',
        seller_id: user.user_id,
        vehicle_id: vehicles[1].vehicle_id,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      },
    }),
    prisma.listing.create({
      data: {
        listing_id: 'listing-003',
        seller_id: user.user_id,
        vehicle_id: vehicles[2].vehicle_id,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      },
    }),
  ]);
  console.log('Listings created');

  // 7. Tạo user interactions cho test user
  await prisma.userInteraction.createMany({
    data: [
      {
        user_id: user.user_id,
        listing_id: 'listing-001',
        type: 'VIEW',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: user.user_id,
        listing_id: 'listing-001',
        type: 'WISHLIST_ADD',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: user.user_id,
        listing_id: 'listing-002',
        type: 'ADD_TO_CART',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        user_id: user.user_id,
        listing_id: 'listing-003',
        type: 'PURCHASE',
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
    ],
  });
  console.log('User interactions created');

  // 8. Tạo một chat giữa user và bot (nếu cần test chat)
  const chat = await prisma.chat.create({
    data: {
      user1_id: user.user_id,
      user2_id: botUser.user_id,
    },
  });
  await prisma.message.createMany({
    data: [
      {
        sender_id: user.user_id,
        receiver_id: botUser.user_id,
        content: 'Xe Giant Talon 29 còn không?',
        chat_id: chat.chat_id,
        listing_id: 'listing-001',
        is_ai_generated: false,
      },
      {
        sender_id: botUser.user_id,
        receiver_id: user.user_id,
        content: 'Chào bạn! Xe Giant Talon 29 vẫn còn hàng nhé. Xe đã qua sử dụng nhưng còn rất tốt, chạy 500km. Bạn có muốn biết thêm chi tiết gì không?',
        chat_id: chat.chat_id,
        listing_id: 'listing-001',
        is_ai_generated: true,
      },
    ],
  });
  console.log('Chat messages created');

  // 9. Tạo review để test analyze-review
  await prisma.review.create({
    data: {
      review_id: 'review-001',
      reviewer_id: user.user_id,
      target_id: user.user_id, // giả sử review cho user (bạn có thể điều chỉnh)
      rating: 5,
      comment: 'Xe rất tốt, giao hàng nhanh, đóng gói cẩn thận. Sẽ ủng hộ shop lần sau.',
      created_at: new Date(),
    },
  });
  console.log('Review created');

  // 10. (Tuỳ chọn) Tạo thêm listing có embedding (nếu bạn muốn test semantic search)
  //    Bạn có thể chạy một script riêng để sinh embedding và cập nhật vào listing.

  console.log('Seeding completed!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });