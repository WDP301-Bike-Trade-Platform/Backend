// src/ai/Service/embedding.service.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config'; // Import cái này
import { firstValueFrom } from 'rxjs';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService, // Inject ConfigService
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    // 1. Lấy cấu hình từ ENV
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = this.configService.get<string>('GEMINI_EMBEDDING_MODEL');
    const baseUrl = this.configService.get<string>('GEMINI_API_BASE_URL');

    // 2. Build URL động
    const url = `${baseUrl}/${model}:embedContent?key=${apiKey}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, {
          model: model, // Dùng biến model từ env
          content: { 
            parts: [{ text }] 
          },
        }),
      );

      // Trả về mảng vector
      return response.data.embedding.values;
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;

      console.error(`[Embedding Error] Model: ${model} | Message: ${errorMessage}`);
      
      throw new HttpException(
        `AI Embedding Failed: ${errorMessage}`,
        status,
      );
    }
  }
}