// src/ai/Service/ai.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { PrismaService } from 'src/database/prisma.service';
import { EmbeddingService } from './embedding.service';
import { SearchDto } from '../DTOs/search.dto';
import { RecommendationDto } from '../DTOs/recommendation.dto';
import { ChatDto } from '../DTOs/chat.dto';
import { AnalyzeReviewDto } from '../DTOs/analyze-review.dto';

interface GeminiTextResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

interface GeminiJsonResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

@Injectable()
export class AIService {
  private readonly geminiApiKey: string;
  private readonly chatModel: string;
  private readonly aiAssistantUserId: string = '00000000-0000-0000-0000-000000000001';

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    // Lấy và kiểm tra API key
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment');
    }
    this.geminiApiKey = apiKey;

    // Lấy và kiểm tra chat model (có thể có default)
    const model = this.configService.get<string>('GEMINI_CHAT_MODEL');
    if (!model) {
      throw new Error('GEMINI_CHAT_MODEL is not set in environment');
    }
    this.chatModel = model;
  }

  // 1. Tìm kiếm thông minh
  async semanticSearch(dto: SearchDto) {
    const { query, limit = 20 } = dto;

    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    const results = await this.prisma.$queryRaw<{ listing_id: string; distance: number }[]>`
      SELECT listing_id, embedding <=> ${queryEmbedding}::vector as distance
      FROM "listings"
      WHERE embedding IS NOT NULL
      ORDER BY distance
      LIMIT ${limit}
    `;

    const listingIds = results.map(r => r.listing_id);
    if (listingIds.length === 0) return [];

    const listings = await this.prisma.listing.findMany({
      where: { listing_id: { in: listingIds } },
      include: {
        vehicle: true,
        media: {
          where: { is_cover: true },
          take: 1,
        },
        seller: {
          select: { full_name: true, user_id: true },
        },
      },
    });

    return listingIds
      .map(id => listings.find(l => l.listing_id === id))
      .filter(Boolean);
  }

  // 2. Gợi ý cá nhân hóa
  async getRecommendations(userId: string, dto: RecommendationDto) {
    const { limit = 10 } = dto;

    const interactions = await this.prisma.userInteraction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    if (interactions.length === 0) {
      return this.getTrendingListings(limit);
    }

    const interactedIds = interactions.map(i => i.listing_id);
    if (interactedIds.length === 0) return this.getTrendingListings(limit);

    const listingsRaw = await this.prisma.$queryRaw<{ listing_id: string; embedding: number[] }[]>`
      SELECT listing_id, embedding
      FROM "listings"
      WHERE listing_id IN (${interactedIds.join(',')}) AND embedding IS NOT NULL
    `;
    const listingsMap = new Map(listingsRaw.map(l => [l.listing_id, l.embedding]));

    const weightMap: Record<string, number> = {
      PURCHASE: 5,
      ADD_TO_CART: 3,
      WISHLIST_ADD: 2,
      VIEW: 1,
    };

    let userEmbedding: number[] | null = null;
    let totalWeight = 0;

    for (const interaction of interactions) {
      const listingEmbedding = listingsMap.get(interaction.listing_id);
      if (listingEmbedding) {
        const weight = weightMap[interaction.type] || 1;
        if (!userEmbedding) {
          userEmbedding = listingEmbedding.map(v => v * weight);
        } else {
          for (let i = 0; i < userEmbedding.length; i++) {
            userEmbedding[i] += listingEmbedding[i] * weight;
          }
        }
        totalWeight += weight;
      }
    }

    if (!userEmbedding) return this.getTrendingListings(limit);
    userEmbedding = userEmbedding.map(v => v / totalWeight);

    const similarListings = await this.prisma.$queryRaw<{ listing_id: string; distance: number }[]>`
      SELECT listing_id, embedding <=> ${userEmbedding}::vector as distance
      FROM "listings"
      WHERE embedding IS NOT NULL
        AND listing_id NOT IN (${interactedIds.join(',')})
      ORDER BY distance
      LIMIT ${limit}
    `;

    const similarIds = similarListings.map(s => s.listing_id);
    if (similarIds.length === 0) return this.getTrendingListings(limit);

    const recommendations = await this.prisma.listing.findMany({
      where: { listing_id: { in: similarIds } },
      include: {
        vehicle: true,
        media: { where: { is_cover: true }, take: 1 },
        seller: { select: { full_name: true, user_id: true } },
      },
    });

    return similarIds
      .map(id => recommendations.find(r => r.listing_id === id))
      .filter(Boolean);
  }

  private async getTrendingListings(limit: number) {
    const trending = await this.prisma.listing.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        vehicle: true,
        media: { where: { is_cover: true }, take: 1 },
        seller: { select: { full_name: true, user_id: true } },
      },
    });
    return trending;
  }

  // 3. Chat tự động
  async chat(userId: string, dto: ChatDto) {
    const { message, listingId, chatId } = dto;

    let listingContext = '';
    if (listingId) {
      const listing = await this.prisma.listing.findUnique({
        where: { listing_id: listingId },
        include: { vehicle: true, seller: { select: { full_name: true } } },
      });
      if (listing) {
        listingContext = `
Sản phẩm: ${listing.vehicle.brand} ${listing.vehicle.model} (${listing.vehicle.year})
Giá: ${listing.vehicle.price}
Tình trạng: ${listing.vehicle.condition}
Mô tả: ${listing.vehicle.description || 'Không có'}
Người bán: ${listing.seller.full_name}
`;
      }
    }

    let historyContext = '';
    if (chatId) {
      const messages = await this.prisma.message.findMany({
        where: { chat_id: chatId },
        orderBy: { created_at: 'desc' },
        take: 5,
        include: { sender: true },
      });
      historyContext = messages
        .reverse()
        .map(m => `${m.sender.full_name}: ${m.content}`)
        .join('\n');
    }

    const prompt = `
Bạn là trợ lý bán hàng cho một sàn thương mại điện tử về xe đạp/xe máy. Hãy trả lời câu hỏi của khách hàng một cách thân thiện và hữu ích.

${listingContext ? `Thông tin sản phẩm đang được hỏi:\n${listingContext}\n` : ''}
${historyContext ? `Lịch sử chat:\n${historyContext}\n` : ''}
Khách hàng hỏi: "${message}"

Hãy trả lời ngắn gọn, dễ hiểu. Nếu không biết, hãy đề nghị liên hệ bộ phận hỗ trợ.
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.chatModel}:generateContent?key=${this.geminiApiKey}`;
    const response = await lastValueFrom(
      this.httpService.post<GeminiTextResponse>(url, {
        contents: [{ parts: [{ text: prompt }] }],
      }),
    );

    const geminiData = response.data;
    const aiResponse = geminiData.candidates[0]?.content?.parts[0]?.text;
    if (!aiResponse) {
      throw new BadRequestException('Failed to generate response from AI');
    }

    let targetChatId = chatId;
    if (!targetChatId) {
      const newChat = await this.prisma.chat.create({
        data: {
          user1_id: userId,
          user2_id: this.aiAssistantUserId,
        },
      });
      targetChatId = newChat.chat_id;
    }

    await this.prisma.message.create({
      data: {
        sender_id: userId,
        receiver_id: this.aiAssistantUserId,
        content: message,
        chat_id: targetChatId,
        listing_id: listingId ?? undefined,
        is_ai_generated: false,
      },
    });

    const botMessage = await this.prisma.message.create({
      data: {
        sender_id: this.aiAssistantUserId,
        receiver_id: userId,
        content: aiResponse,
        chat_id: targetChatId,
        listing_id: listingId ?? undefined,
        is_ai_generated: true,
      },
    });

    return {
      chatId: targetChatId,
      messageId: botMessage.message_id,
      response: aiResponse,
    };
  }

  // 4. Phân tích review
  async analyzeReview(dto: AnalyzeReviewDto) {
    const { reviewId, comment } = dto;

    let reviewText = comment;
    if (!reviewText) {
      const review = await this.prisma.review.findUnique({
        where: { review_id: reviewId },
      });
      if (!review) throw new BadRequestException('Review not found');
      reviewText = review.comment ?? undefined;
    }

    if (!reviewText) {
      throw new BadRequestException('Review comment is empty');
    }

    const prompt = `
Phân tích đánh giá sau đây, cho điểm tin cậy (0-1), phát hiện spam/giả, và cảm xúc.
Đánh giá: "${reviewText}"
Trả về JSON với các trường: confidence (float), is_fake (boolean), sentiment (positive/neutral/negative), keywords (array), reason (string).
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.chatModel}:generateContent?key=${this.geminiApiKey}`;
    const response = await lastValueFrom(
      this.httpService.post<GeminiJsonResponse>(
        url,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const geminiData = response.data;
    const rawText = geminiData.candidates[0]?.content?.parts[0]?.text;
    if (!rawText) {
      throw new BadRequestException('Failed to analyze review');
    }

    let analysis;
    try {
      analysis = JSON.parse(rawText);
    } catch {
      analysis = {
        confidence: 0.5,
        is_fake: false,
        sentiment: 'neutral',
        keywords: [],
        reason: 'Failed to parse AI response',
      };
    }

    if (reviewId) {
      await this.prisma.review.update({
        where: { review_id: reviewId },
        data: {
          confidence_score: analysis.confidence,
          is_flagged: analysis.is_fake,
          analysis_result: analysis,
          analyzed_at: new Date(),
        },
      });
    }

    return analysis;
  }
}