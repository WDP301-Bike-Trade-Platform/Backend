import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Notification, NotificationType } from '@prisma/client';
import { PrismaService } from 'src/database/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationListQueryDto } from './dto/notification-query.dto';

export interface NotificationItemDto {
  notificationId: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationService {
  private readonly DEFAULT_TAKE = 20;
  private readonly MAX_TAKE = 100;

  constructor(private readonly prisma: PrismaService) {}

  async getMyNotifications(userId: string, query: NotificationListQueryDto) {
    const skip = query.skip ?? 0;
    const take = Math.min(query.take ?? this.DEFAULT_TAKE, this.MAX_TAKE);

    const [total, notifications] = await this.prisma.$transaction([
      this.prisma.notification.count({ where: { user_id: userId } }),
      this.prisma.notification.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      success: true,
      data: {
        total,
        items: notifications.map((notification) =>
          this.mapNotification(notification),
        ),
      },
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        notification_id: notificationId,
        user_id: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.is_read) {
      await this.prisma.notification.update({
        where: { notification_id: notificationId },
        data: { is_read: true },
      });
    }

    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false,
      },
      data: { is_read: true },
    });

    return {
      success: true,
      data: {
        updatedCount: result.count,
      },
    };
  }

  async createNotification(dto: CreateNotificationDto) {
    if (!dto.userId?.trim()) {
      throw new BadRequestException('User id is required');
    }

    const notification = await this.prisma.notification.create({
      data: {
        user_id: dto.userId,
        title: dto.title.trim(),
        message: dto.message.trim(),
        type: dto.type ?? NotificationType.SYSTEM,
        link: dto.link ?? null,
        is_read: false,
        created_at: new Date(),
      },
    });

    return {
      success: true,
      data: this.mapNotification(notification),
    };
  }

  private mapNotification(notification: Notification): NotificationItemDto {
    return {
      notificationId: notification.notification_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link ?? null,
      isRead: notification.is_read,
      createdAt: notification.created_at,
    };
  }
}
