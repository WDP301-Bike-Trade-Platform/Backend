import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/common/auth/jwt.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtUser } from 'src/common/types/types';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatMessageQueryDto } from './dto/chat-query.dto';

@ApiTags('Chats')
@ApiBearerAuth('access-token')
@Controller('chats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @Roles(1)
  @ApiOperation({ summary: 'Lấy danh sách cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Danh sách cuộc trò chuyện' })
  async getMyChats(@Req() req: Request & { user: JwtUser }) {
    const threads = await this.chatService.getMyChats(req.user.user_id);
    return { success: true, data: threads };
  }

  @Post()
  @Roles(1)
  @ApiOperation({ summary: 'Tạo hoặc lấy cuộc trò chuyện với người dùng khác' })
  @ApiResponse({ status: 200, description: 'Cuộc trò chuyện' })
  async createOrGetChat(
    @Req() req: Request & { user: JwtUser },
    @Body() dto: CreateChatDto,
  ) {
    const thread = await this.chatService.createOrGetChat(
      req.user.user_id,
      dto,
    );
    return { success: true, data: thread };
  }

  @Get(':chatId/messages')
  @Roles(1)
  @ApiOperation({ summary: 'Lấy tin nhắn trong cuộc trò chuyện' })
  @ApiResponse({ status: 200, description: 'Danh sách tin nhắn' })
  async getMessages(
    @Req() req: Request & { user: JwtUser },
    @Param('chatId') chatId: string,
    @Query() query: ChatMessageQueryDto,
  ) {
    const result = await this.chatService.getMessages(
      req.user.user_id,
      chatId,
      query,
    );
    return { success: true, data: result };
  }

  @Post(':chatId/messages')
  @Roles(1)
  @ApiOperation({ summary: 'Gửi tin nhắn trong cuộc trò chuyện' })
  @ApiResponse({ status: 201, description: 'Gửi tin nhắn thành công' })
  async sendMessage(
    @Req() req: Request & { user: JwtUser },
    @Param('chatId') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(req.user.user_id, chatId, dto);
  }
}
