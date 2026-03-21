// ai.controller.ts
import { Controller, Post, Body, Get, UseGuards, Req, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AIService } from '../Service/ai.service';
import { SearchDto } from '../DTOs/search.dto';
import { RecommendationDto } from '../DTOs/recommendation.dto';
import { ChatDto } from '../DTOs/chat.dto';
import { AnalyzeReviewDto } from '../DTOs/analyze-review.dto';
import type { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    user_id: string;
    role_name: string; // 'USER' | 'INSPECTOR' | 'ADMIN' (theo schema)
  };
}

@ApiTags('AI')
@ApiBearerAuth('access-token')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  /**
   * Tìm kiếm sản phẩm thông minh bằng ngữ nghĩa (Semantic Search)
   * - Cho phép tất cả người dùng đã đăng nhập (USER, INSPECTOR, ADMIN)
   * - Sử dụng AI để hiểu ý định tìm kiếm, không chỉ từ khóa.
   */
  @Post('search')
  @Roles(1, 2, 3) // 1=USER, 2=INSPECTOR, 3=ADMIN (theo schema)
  @ApiOperation({
    summary: 'Tìm kiếm sản phẩm thông minh (Semantic Search)',
    description: `
      Tìm kiếm sản phẩm bằng ngữ nghĩa tự nhiên.
      - **USER**: tìm kiếm để mua hàng.
      - **INSPECTOR**: tìm kiếm để kiểm định.
      - **ADMIN**: tìm kiếm để quản lý.
      - Sử dụng AI (Gemini) để hiểu câu query, trả về danh sách listing phù hợp nhất.
      - Kết quả sắp xếp theo độ tương đồng (điểm gần nhất).
    `,
  })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm phù hợp' })
  async semanticSearch(@Body() dto: SearchDto) {
    return this.aiService.semanticSearch(dto);
  }

  /**
   * Gợi ý sản phẩm cá nhân hóa dựa trên hành vi người dùng
   * - Chỉ dành cho USER (người mua) vì INSPECTOR/ADMIN không cần gợi ý mua hàng
   */
  @Get('recommendations')
  @Roles(1) // Chỉ USER
  @ApiOperation({
    summary: 'Gợi ý sản phẩm cá nhân hóa',
    description: `
      Gợi ý sản phẩm dựa trên lịch sử tương tác của người dùng (xem, thêm giỏ, mua, wishlist).
      - **USER**: nhận gợi ý riêng (cá nhân hóa).
      - Thuật toán: dùng embedding của user được tính từ các sản phẩm đã tương tác.
      - Hỗ trợ phân trang (limit).
    `,
  })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm gợi ý' })
  async getRecommendations(
    @Req() req: RequestWithUser,
    @Query() dto: RecommendationDto,
  ) {
    const userId = req.user.user_id;
    return this.aiService.getRecommendations(userId, dto);
  }

  /**
   * Chat hỗ trợ bán hàng tự động (AI Sales Assistant)
   * - Cho phép USER và ADMIN chat với AI.
   * - ADMIN có thể chat để hỗ trợ khách hàng.
   */
  @Post('chat')
  @Roles(1, 3) // USER và ADMIN
  @ApiOperation({
    summary: 'Chat hỗ trợ bán hàng tự động',
    description: `
      Trò chuyện với AI Assistant để được tư vấn sản phẩm, hỗ trợ đơn hàng, chính sách vận chuyển, v.v.
      - **USER**: hỏi về sản phẩm, trạng thái đơn hàng.
      - **ADMIN**: có thể chat để kiểm tra hoặc hỗ trợ khách.
      - Tin nhắn của AI được lưu vào hệ thống (message.is_ai_generated = true).
      - Yêu cầu truyền \`message\`, có thể truyền \`listingId\` để AI biết sản phẩm đang hỏi, và \`chatId\` để tiếp tục cuộc hội thoại cũ.
    `,
  })
  @ApiResponse({ status: 200, description: 'Phản hồi từ AI' })
  async chat(
    @Req() req: RequestWithUser,
    @Body() dto: ChatDto,
  ) {
    const userId = req.user.user_id;
    return this.aiService.chat(userId, dto);
  }

  /**
   * Phân tích đánh giá sản phẩm (Review Analysis)
   * - Cho phép ADMIN hoặc chính người dùng gửi review để phân tích.
   * - Đánh giá được phân tích về độ tin cậy, spam, cảm xúc.
   */
  @Post('analyze-review')
  @Roles(1, 3) // USER và ADMIN
  @ApiOperation({
    summary: 'Phân tích đánh giá sản phẩm',
    description: `
      Phân tích nội dung đánh giá (review) bằng AI:
      - **Điểm tin cậy (0-1)**: đánh giá thật hay giả.
      - **Phát hiện spam**: is_fake = true nếu nghi ngờ spam.
      - **Cảm xúc**: positive/neutral/negative.
      - **Từ khóa**: các từ nổi bật trong review.
      - **Lý do**: giải thích tại sao đánh giá đó có điểm tin cậy như vậy.
      - Có thể truyền \`reviewId\` (nếu đã có sẵn) hoặc \`comment\` (nếu chưa lưu).
      - Kết quả phân tích được lưu vào bảng \`reviews\` (các trường confidence_score, is_flagged, analysis_result).
    `,
  })
  @ApiResponse({ status: 200, description: 'Kết quả phân tích' })
  async analyzeReview(@Body() dto: AnalyzeReviewDto) {
    return this.aiService.analyzeReview(dto);
  }
}