import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Message } from '../entities/message.entity';
import { SendMessageDto } from '../dto/message.dto';

@Injectable()
export class MessageService {
  private readonly MAX_MESSAGES = 50;
  private readonly CACHE_TTL = 3600; // 1 ساعت
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async getRecnetMessages(roomId: string) {

    return await this.messageRepo.find({where:{roomId},order:{created_at:'DESC'}});

  }

  async create({ text, roomId, senderId }: { text: string, roomId: string, senderId: string }) {
    const message = this.messageRepo.create({
      text,
      roomId,
      senderId,
    });
    return this.messageRepo.save(message);
  }
  async seenMessages(roomId: string, userId: string) {
    const unreadMessages = await this.messageRepo.find({
      where: { roomId, isRead: false, senderId: Not(userId) },
    });

    if (unreadMessages.length > 0) {
      // Update messages in database
      await this.messageRepo.update(
        { id: In(unreadMessages.map(msg => msg.id)) },
        { isRead: true }
      );

      // Update messages in Redis cache
      const key = `room:messages:${roomId}`;
      const cachedMessages = await this.redisClient.lrange(key, 0, -1);
      
      if (cachedMessages.length > 0) {
        const pipeline = this.redisClient.pipeline();
        
        cachedMessages.forEach((msgStr, index) => {
          const msg = JSON.parse(msgStr);
          if (unreadMessages.some(um => um.id === msg.id)) {
            msg.isRead = true;
            pipeline.lset(key, index, JSON.stringify(msg));
          }
        });

        await pipeline.exec();
      }

      return unreadMessages;
    }

    return [];
  }
  
}
