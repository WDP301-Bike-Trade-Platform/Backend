import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { NotificationService } from '../Notification/notification.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatMessageQueryDto } from './dto/chat-query.dto';
import { SendMessageDto } from './dto/send-message.dto';

/* ── Response interfaces ─────────────────────────────────── */

export interface ChatUserInfo {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface ChatThreadResponse {
  chatId: string;
  otherUserId: string;
  otherUser: ChatUserInfo | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

export interface MessageResponse {
  messageId: string;
  chatId: string;
  senderId: string;
  content: string | null;
  imageUrl: string | null;
  sentAt: Date;
}

/* ── Service ─────────────────────────────────────────────── */

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /** Lấy danh sách cuộc trò chuyện của user hiện tại */
  async getMyChats(userId: string): Promise<ChatThreadResponse[]> {
    const chats = await this.prisma.chat.findMany({
      where: {
        OR: [{ user1_id: userId }, { user2_id: userId }],
      },
      include: {
        user1: { include: { profile: true } },
        user2: { include: { profile: true } },
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    return chats
      .map((chat) => {
        const isUser1 = chat.user1_id === userId;
        const otherUser = isUser1 ? chat.user2 : chat.user1;
        const lastMsg = chat.messages[0] ?? null;

        return {
          chatId: chat.chat_id,
          otherUserId: isUser1 ? chat.user2_id : chat.user1_id,
          otherUser: otherUser
            ? {
                userId: otherUser.user_id,
                email: otherUser.email,
                fullName: otherUser.full_name,
                avatarUrl: otherUser.profile?.avatar_url ?? null,
              }
            : null,
          lastMessage: lastMsg?.content ?? lastMsg?.image_url ?? null,
          lastMessageAt: lastMsg?.created_at ?? null,
        };
      })
      .sort(
        (a, b) =>
          (b.lastMessageAt?.getTime() ?? 0) -
          (a.lastMessageAt?.getTime() ?? 0),
      );
  }

  /** Tạo hoặc lấy cuộc trò chuyện giữa 2 user */
  async createOrGetChat(
    userId: string,
    dto: CreateChatDto,
  ): Promise<ChatThreadResponse> {
    if (dto.otherUserId === userId) {
      throw new BadRequestException(
        'Bạn không thể tạo cuộc trò chuyện với chính mình.',
      );
    }

    // Kiểm tra user kia có tồn tại không
    const otherUser = await this.prisma.user.findUnique({
      where: { user_id: dto.otherUserId },
      include: { profile: true },
    });
    if (!otherUser) {
      throw new NotFoundException('Không tìm thấy người dùng.');
    }

    // Tìm cuộc trò chuyện đã có
    const existing = await this.prisma.chat.findFirst({
      where: {
        OR: [
          { user1_id: userId, user2_id: dto.otherUserId },
          { user1_id: dto.otherUserId, user2_id: userId },
        ],
      },
      include: {
        messages: { orderBy: { created_at: 'desc' }, take: 1 },
      },
    });

    if (existing) {
      const lastMsg = existing.messages[0] ?? null;
      return {
        chatId: existing.chat_id,
        otherUserId: dto.otherUserId,
        otherUser: {
          userId: otherUser.user_id,
          email: otherUser.email,
          fullName: otherUser.full_name,
          avatarUrl: otherUser.profile?.avatar_url ?? null,
        },
        lastMessage: lastMsg?.content ?? lastMsg?.image_url ?? null,
        lastMessageAt: lastMsg?.created_at ?? null,
      };
    }

    // Tạo mới
    const chat = await this.prisma.chat.create({
      data: {
        user1_id: userId,
        user2_id: dto.otherUserId,
      },
    });

    return {
      chatId: chat.chat_id,
      otherUserId: dto.otherUserId,
      otherUser: {
        userId: otherUser.user_id,
        email: otherUser.email,
        fullName: otherUser.full_name,
        avatarUrl: otherUser.profile?.avatar_url ?? null,
      },
      lastMessage: null,
      lastMessageAt: null,
    };
  }

  /** Lấy tin nhắn của một cuộc trò chuyện (phân trang) */
  async getMessages(
    userId: string,
    chatId: string,
    query: ChatMessageQueryDto,
  ): Promise<{ total: number; items: MessageResponse[] }> {
    // Kiểm tra user có thuộc cuộc trò chuyện này
    const chat = await this.prisma.chat.findFirst({
      where: {
        chat_id: chatId,
        OR: [{ user1_id: userId }, { user2_id: userId }],
      },
    });
    if (!chat) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện.');
    }

    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? 20, 100);

    const [total, messages] = await this.prisma.$transaction([
      this.prisma.message.count({ where: { chat_id: chatId } }),
      this.prisma.message.findMany({
        where: { chat_id: chatId },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      total,
      items: messages.map((m) => ({
        messageId: m.message_id,
        chatId: m.chat_id!,
        senderId: m.sender_id,
        content: m.content,
        imageUrl: m.image_url,
        sentAt: m.created_at,
      })),
    };
  }

  /** Gửi tin nhắn trong cuộc trò chuyện */
  async sendMessage(
    userId: string,
    chatId: string,
    dto: SendMessageDto,
  ): Promise<{ success: boolean; message: string; data: MessageResponse }> {
    if (!dto.content?.trim() && !dto.imageUrl?.trim()) {
      throw new BadRequestException(
        'Nội dung hoặc hình ảnh không được để trống.',
      );
    }

    const chat = await this.prisma.chat.findFirst({
      where: {
        chat_id: chatId,
        OR: [{ user1_id: userId }, { user2_id: userId }],
      },
    });
    if (!chat) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện.');
    }

    const msg = await this.prisma.message.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        content: dto.content?.trim() ?? null,
        image_url: dto.imageUrl?.trim() ?? null,
      },
    });

    // Gửi notification cho người nhận
    const receiverId =
      chat.user1_id === userId ? chat.user2_id : chat.user1_id;
    await this.notifyAsync(
      receiverId,
      'Tin nhắn mới',
      'Bạn có tin nhắn mới.',
      `/chat/${chatId}`,
    );

    return {
      success: true,
      message: 'Đã gửi tin nhắn.',
      data: {
        messageId: msg.message_id,
        chatId: msg.chat_id!,
        senderId: msg.sender_id,
        content: msg.content,
        imageUrl: msg.image_url,
        sentAt: msg.created_at,
      },
    };
  }

  /** Gửi notification mà không throw nếu lỗi */
  private async notifyAsync(
    userId: string,
    title: string,
    message: string,
    link?: string,
  ) {
    try {
      await this.notificationService.createNotification({
        userId,
        title,
        message,
        type: NotificationType.MESSAGE,
        link,
      });
    } catch {
      // Bỏ qua lỗi notification
    }
  }
}
