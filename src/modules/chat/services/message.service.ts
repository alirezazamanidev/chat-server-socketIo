import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Message } from '../entities/message.entity';
import { SendMessageDto } from '../dto/message.dto';

@Injectable()
export class MessageService {
  private readonly MAX_MESSAGES = 50;
  private readonly CACHE_TTL = 3600; // 1 ساعت
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async markedMessages(roomId: string,userId:string): Promise<void> {
    try {
      await this.messageRepo.update(
        { roomId, isRead: false,senderId:Not(userId) },
        
        { isRead: true }
      );
      this.logger.log(`Marked all unread messages as read in room ${roomId}`);
    } catch (error) {
      this.logger.error(`Error marking messages as read in room ${roomId}: ${error.message}`);
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }
  async getRecentMessages(roomId: string) {
    try {
      return this.messageRepo.find({
        where: { roomId },
        relations: ['sender'],
        select: {
          sender: { id: true, username: true, fullName: true, avatar: true, created_at: true },
        },
        order: { created_at: 'ASC' },
        take: this.MAX_MESSAGES,
      });
      
    } catch (error) {
      this.logger.error(`Error retrieving messages for room ${roomId}: ${error.message}`);
     
    }
  }

  async createMessage(sendMessageDto: SendMessageDto, senderId: string): Promise<Message> {
    const { text, roomId } = sendMessageDto;
  
    try {
      // ساخت و ذخیره پیام توی دیتابیس
      const message = this.messageRepo.create({
        senderId,
        text,
        roomId,
      });
      const savedMessage = await this.messageRepo.save(message);

      this.logger.log(`Message created in room ${roomId} by sender ${senderId}`);
      return savedMessage;
    } catch (error) {
      this.logger.error(`Error creating message in room ${roomId}: ${error.message}`);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }
}