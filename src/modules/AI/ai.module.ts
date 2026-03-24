// src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../Auth/auth.module';
import { AIController } from './Controller/ai.controller';
import { AIService } from './Service/ai.service';
import { EmbeddingService } from './Service/embedding.service';
import { HttpModule } from '@nestjs/axios';
@Module({
  imports: [AuthModule, HttpModule,],
  controllers: [AIController],
  providers: [AIService, EmbeddingService],
  exports: [EmbeddingService], // 👈 QUAN TRỌNG: phải export

})
export class AIModule {}