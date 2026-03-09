import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  /** userId → Set<socketId> (một user có thể mở nhiều device) */
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  /* ── Connection lifecycle ──────────────────────────────── */

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token: string | undefined =
        (client.handshake.auth?.token as string) ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        role_id: number;
      }>(token, { secret: process.env.JWT_SECRET });

      const userId = payload.sub;
      client.userId = userId;

      // Track socket
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Auto-join vào tất cả chat rooms của user
      const chats = await this.chatService.getMyChats(userId);
      for (const chat of chats) {
        await client.join(`chat:${chat.chatId}`);
      }

      client.emit('connected', { userId });
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const sockets = this.userSockets.get(client.userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(client.userId);
        }
      }
    }
  }

  /* ── Events ────────────────────────────────────────────── */

  /** Client join vào 1 chat room cụ thể */
  @SubscribeMessage('joinChat')
  async handleJoinChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!client.userId) return;
    await client.join(`chat:${data.chatId}`);
    client.emit('joinedChat', { chatId: data.chatId });
  }

  /** Client rời khỏi chat room */
  @SubscribeMessage('leaveChat')
  async handleLeaveChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    await client.leave(`chat:${data.chatId}`);
  }

  /** Client gửi tin nhắn */
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { chatId: string; content?: string; imageUrl?: string },
  ) {
    if (!client.userId) return;

    const result = await this.chatService.sendMessage(
      client.userId,
      data.chatId,
      { content: data.content, imageUrl: data.imageUrl },
    );

    // Broadcast tin nhắn tới tất cả members trong room
    this.server.to(`chat:${data.chatId}`).emit('newMessage', result.data);

    return { success: true, data: result.data };
  }

  /** Client đang gõ */
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!client.userId) return;
    client.to(`chat:${data.chatId}`).emit('userTyping', {
      chatId: data.chatId,
      userId: client.userId,
    });
  }

  /** Client ngừng gõ */
  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!client.userId) return;
    client.to(`chat:${data.chatId}`).emit('userStopTyping', {
      chatId: data.chatId,
      userId: client.userId,
    });
  }

  /* ── Helper: emit từ service (dùng cho REST fallback) ─── */

  /** Emit newMessage event tới chat room (gọi từ ChatService) */
  emitNewMessage(chatId: string, message: unknown) {
    this.server.to(`chat:${chatId}`).emit('newMessage', message);
  }

  /** Emit event tới một user cụ thể */
  emitToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      for (const socketId of sockets) {
        this.server.to(socketId).emit(event, data);
      }
    }
  }
}
