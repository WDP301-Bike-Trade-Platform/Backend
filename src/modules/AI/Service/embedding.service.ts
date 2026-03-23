import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async generateEmbedding(text: string): Promise<number[]> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const model = this.configService.get<string>('GEMINI_EMBEDDING_MODEL');
    const baseUrl = this.configService.get<string>('GEMINI_API_BASE_URL');

    if (!apiKey || !model || !baseUrl) {
      throw new Error('Missing Gemini configuration');
    }

    // Build URL
    const url = `${baseUrl}/${model}:embedContent?key=${apiKey}`;

    // Payload với outputDimensionality = 768
    const payload = {
      model: model, // hoặc 'models/' + model
      content: {
        parts: [{ text }]
      },
      outputDimensionality: 768 // 👈 quan trọng
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const embedding = response.data?.embedding?.values;
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response');
      }

      // Đảm bảo độ dài đúng 768 (phòng trường hợp API không tuân thủ)
      if (embedding.length !== 768) {
        console.warn(`Embedding dimension mismatch: got ${embedding.length}, expected 768. Truncating/padding.`);
        if (embedding.length > 768) return embedding.slice(0, 768);
        while (embedding.length < 768) embedding.push(0);
      }

      return embedding;
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