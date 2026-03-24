import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';        // nếu EmbeddingService cần ConfigService
import { HttpModule } from '@nestjs/axios';           // nếu EmbeddingService cần HttpService
import { PrismaService } from '../src/database/prisma.service';          // đường dẫn tương đối
import { EmbeddingService } from '../src/modules/AI/Service/embedding.service'; // đường dẫn tương đối
// import { AIModule } from '../src/modules/AI/ai.module'; // nếu cần, nhưng ta sẽ tự cấp provider

// Tạo module tối giản chứa các service cần thiết
@Module({
  imports: [
    ConfigModule.forRoot(),   // để EmbeddingService có thể đọc GEMINI_API_KEY
    HttpModule,               // để EmbeddingService có thể gọi HTTP
    // Nếu có DatabaseModule riêng thì thay thế bằng import của bạn
  ],
  providers: [PrismaService, EmbeddingService],
})
class BackfillModule {}

async function backfill() {
  const app = await NestFactory.createApplicationContext(BackfillModule);
  const prisma = app.get(PrismaService);
  const embeddingService = app.get(EmbeddingService);

  // Lấy các listing chưa có embedding (dùng raw SQL)
  const listingsRaw = await prisma.$queryRaw<{ listing_id: string }[]>`
    SELECT listing_id FROM listings WHERE embedding IS NULL
  `;

  console.log(`Found ${listingsRaw.length} listings without embedding.`);

  for (const { listing_id } of listingsRaw) {
    const listing = await prisma.listing.findUnique({
      where: { listing_id },
      include: { vehicle: true },
    });

    if (!listing?.vehicle) {
      console.warn(`Listing ${listing_id} not found or missing vehicle`);
      continue;
    }

    const vehicle = listing.vehicle;
    const description = `
      ${vehicle.brand} ${vehicle.model} ${vehicle.year}
      Giá: ${vehicle.price}
      Tình trạng: ${vehicle.condition}
      Loại xe: ${vehicle.bike_type}
      Khung: ${vehicle.material}
      Phanh: ${vehicle.brake_type}
      Nhóm linh kiện: ${vehicle.groupset || ''}
      Kích thước khung: ${vehicle.frame_size || ''}
      Số km đã đi: ${vehicle.mileage_km || ''}
      Mô tả: ${vehicle.description || ''}
    `.trim();

    try {
      const embedding = await embeddingService.generateEmbedding(description);
      if (embedding) {
        await prisma.$executeRaw`
          UPDATE listings
          SET embedding = ${JSON.stringify(embedding)}::vector
          WHERE listing_id = ${listing_id}
        `;
        console.log(`✅ Updated listing ${listing_id}`);
      } else {
        console.warn(`⚠️ Could not generate embedding for listing ${listing_id}`);
      }
    } catch (error) {
      console.error(`❌ Error with listing ${listing_id}:`, error.message);
    }
  }

  console.log('Backfill completed');
  await app.close();
}

backfill();