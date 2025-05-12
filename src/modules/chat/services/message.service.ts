import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Message } from '../entities/message.entity';
import { CreateMessageDto, SendMessageDto } from '../dto/message.dto';
import { Room } from '../entities/room.entity';

@Injectable()
export class MessageService {
  private readonly MAX_MESSAGES = 50;
  private readonly CACHE_TTL = 3600; // 1 ساعت
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  /**
   * دریافت پیام‌های اخیر یک اتاق و علامت‌گذاری پیام‌های خوانده‌نشده
   * @param roomId ID اتاق
   * @param userId ID کاربر درخواست‌دهنده
   * @returns لیست پیام‌های اخیر
   */
  async getRecentMessages(roomId: string, userId: string): Promise<Message[]> {
    if (!roomId || !userId) {
      throw new BadRequestException('Room ID and user ID are required');
    }

    try {
      // بررسی دسترسی کاربر به اتاق
      await this.validateRoomAccess(roomId, userId);

      // چک کردن کش
      const cacheKey = `room:messages:${roomId}`;
      const cachedMessages = await this.redisClient.lrange(cacheKey, 0, -1);
      if (cachedMessages.length > 0) {
        return cachedMessages.map((msg) => JSON.parse(msg));
      }

      // گرفتن پیام‌های اخیر از دیتابیس
      const messages = await this.messageRepo.find({
        where: { roomId },
        order: { created_at: 'DESC' },
        take: this.MAX_MESSAGES,
        relations: ['sender'],
      });

      // علامت‌گذاری پیام‌های خوانده‌نشده (فقط پیام‌های دیگران)
      await this.messageRepo
        .createQueryBuilder()
        .update(Message)
        .set({ isRead: true })
        .where('roomId = :roomId', { roomId })
        .andWhere('isRead = :isRead', { isRead: false })
        .andWhere('senderId != :userId', { userId })
        .execute();

      // ذخیره پیام‌ها در کش
      if (messages.length > 0) {
        const pipeline = this.redisClient.pipeline();
        messages.forEach((msg) => pipeline.rpush(cacheKey, JSON.stringify(msg)));
        pipeline.ltrim(cacheKey, -this.MAX_MESSAGES, -1); // محدود کردن به MAX_MESSAGES
        pipeline.expire(cacheKey, this.CACHE_TTL);
        await pipeline.exec();
      }

      // آپدیت تعداد پیام‌های خوانده‌نشده در Redis
      await this.redisClient.set(`unread:${roomId}:${userId}`, '0', 'EX', this.CACHE_TTL);

      return messages.reverse(); // نمایش از قدیمی به جدید
    } catch (error) {
      this.logger.error(`Error in getRecentMessages: ${error.message}`);
      throw error;
    }
  }

  /**
   * علامت‌گذاری یک پیام خاص به‌عنوان خوانده‌شده
   * @param msgId ID پیام
   * @param userId ID کاربر درخواست‌دهنده
   */
  async seenMessage(msgId: string, userId: string): Promise<void> {
    if (!msgId || !userId) {
      throw new BadRequestException('Message ID and user ID are required');
    }

    try {
      const message = await this.messageRepo.findOne({
        where: { id: msgId },
        relations: ['room', 'room.participants'],
      });
      if (!message) {
        throw new NotFoundException('Message not found');
      }
      if (!message.room.participants.some((p) => p.id === userId)) {
        throw new ForbiddenException('You are not a participant in this room');
      }
      if (message.senderId === userId) {
        throw new BadRequestException('You cannot mark your own message as read');
      }

      if (!message.isRead) {
        await this.messageRepo.update({ id: msgId }, { isRead: true });

        // آپدیت کش
        const cacheKey = `room:messages:${message.roomId}`;
        const cachedMessages = await this.redisClient.lrange(cacheKey, 0, -1);
        if (cachedMessages.length > 0) {
          const index = cachedMessages.findIndex((msg) => JSON.parse(msg).id === msgId);
          if (index !== -1) {
            const updatedMessage = JSON.parse(cachedMessages[index]);
            updatedMessage.isRead = true;
            await this.redisClient.lset(cacheKey, index, JSON.stringify(updatedMessage));
          }
        }

        // کاهش تعداد پیام‌های خوانده‌نشده در Redis
        await this.redisClient.decr(`unread:${message.roomId}:${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error in seenMessage: ${error.message}`);
      throw error;
    }
  }

  /**
   * ایجاد پیام جدید
   * @param sendMessageDto DTO شامل اطلاعات پیام
   * @returns پیام ایجادشده
   */
  async create(msgDto:CreateMessageDto): Promise<Message> {
    const { text,roomId,senderId } = msgDto;
   
    try {
      // بررسی دسترسی کاربر به اتاق
      const room = await this.validateRoomAccess(roomId, senderId);

      // ایجاد و ذخیره پیام در یک تراکنش
      return await this.messageRepo.manager.transaction(async (manager) => {
        const message = manager.create(Message, {
          text,
          roomId,
          senderId,
        });
        const savedMessage = await manager.save(Message, message);

        // آپدیت lastMessage و lastMessageAt اتاق
        await manager.update(Room, { id: roomId }, { 
          lastMessage: savedMessage, 
      
        });

        // اضافه کردن به کش
        const cacheKey = `room:messages:${roomId}`;
        await this.redisClient.rpush(cacheKey, JSON.stringify(savedMessage));
        await this.redisClient.ltrim(cacheKey, -this.MAX_MESSAGES, -1);
        await this.redisClient.expire(cacheKey, this.CACHE_TTL);

        // افزایش تعداد پیام‌های خوانده‌نشده برای گیرنده‌ها
        const receiverIds = room.participants
          .filter((p) => p.id !== senderId)
          .map((p) => p.id);
        const pipeline = this.redisClient.pipeline();
        receiverIds.forEach((receiverId) => {
          pipeline.incr(`unread:${roomId}:${receiverId}`);
        });
        await pipeline.exec();

        // انتشار رویداد جدید برای هماهنگی بین سرورها
        await this.redisClient.publish(`room:${roomId}:new_message`, JSON.stringify(savedMessage));

        return savedMessage;
      });
    } catch (error) {
      this.logger.error(`Error in create: ${error.message}`);
      throw error;
    }
  }

  /**
   * علامت‌گذاری پیام‌های خوانده‌نشده یک اتاق به‌عنوان خوانده‌شده
   * @param roomId ID اتاق
   * @param userId ID کاربر درخواست‌دهنده
   * @returns تعداد پیام‌های آپدیت‌شده
   */
  async seenMessages(roomId: string, userId: string): Promise<number> {
    if (!roomId || !userId) {
      throw new BadRequestException('Room ID and user ID are required');
    }

    try {
      // بررسی دسترسی کاربر به اتاق
      await this.validateRoomAccess(roomId, userId);

      // آپدیت پیام‌های خوانده‌نشده
      const { affected } = await this.messageRepo
        .createQueryBuilder()
        .update(Message)
        .set({ isRead: true })
        .where('roomId = :roomId', { roomId })
        .andWhere('isRead = :isRead', { isRead: false })
        .andWhere('senderId != :userId', { userId })
        .execute();

      if (affected && affected > 0) {
        // آپدیت کش
        const cacheKey = `room:messages:${roomId}`;
        const cachedMessages = await this.redisClient.lrange(cacheKey, 0, -1);
        if (cachedMessages.length > 0) {
          const pipeline = this.redisClient.pipeline();
          cachedMessages.forEach((msgStr, index) => {
            const msg = JSON.parse(msgStr);
            if (msg.senderId !== userId && !msg.isRead) {
              msg.isRead = true;
              pipeline.lset(cacheKey, index, JSON.stringify(msg));
            }
          });
          await pipeline.exec();
        }

        // ریست تعداد پیام‌های خوانده‌نشده
        await this.redisClient.set(`unread:${roomId}:${userId}`, '0', 'EX', this.CACHE_TTL);
      }

      return affected || 0;
    } catch (error) {
      this.logger.error(`Error in seenMessages: ${error.message}`);
      throw error;
    }
  }

  /**
   * دریافت تعداد پیام‌های خوانده‌نشده یک اتاق
   * @param roomId ID اتاق
   * @param userId ID کاربر
   * @returns تعداد پیام‌های خوانده‌نشده
   */
  async getUnreadCount(roomId: string, userId: string): Promise<number> {
    if (!roomId || !userId) {
      throw new BadRequestException('Room ID and user ID are required');
    }

    try {
      const cacheKey = `unread:${roomId}:${userId}`;
      const cachedCount = await this.redisClient.get(cacheKey);
      if (cachedCount !== null) {
        return parseInt(cachedCount, 10);
      }

      const count = await this.messageRepo
        .createQueryBuilder('message')
        .where('message.roomId = :roomId', { roomId })
        .andWhere('message.senderId != :userId', { userId })
        .andWhere('message.isRead = :isRead', { isRead: false })
        .getCount();

      await this.redisClient.setex(cacheKey, this.CACHE_TTL, count.toString());
      return count;
    } catch (error) {
      this.logger.error(`Error in getUnreadCount: ${error.message}`);
      return 0;
    }
  }

  /**
   * بررسی دسترسی کاربر به اتاق
   * @param roomId ID اتاق
   * @param userId ID کاربر
   * @returns اطلاعات اتاق
   */
  private async validateRoomAccess(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { participants: true },
    });
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    if (!room.participants.some((p) => p.id === userId)) {
      throw new ForbiddenException('You are not a participant in this room');
    }
    return room;
  }
}