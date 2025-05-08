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
    const key = `room:messages:${roomId}`;
    let messages: any = await this.redisClient.lrange(
      key,
      0,
      this.MAX_MESSAGES,
    );
    messages = messages ? messages.map((message) => JSON.parse(message)) : [];
    if (messages && messages.length === 0) {
      messages = await this.messageRepo.find({
        where: { roomId },
        relations: ['sender'],
        select: { sender: { id: true, username: true, avatar: true } },
        take: 50,
      });
      if (messages.length > 0) {
        await this.redisClient.rpushx(key, ...messages, this.CACHE_TTL);
      }
    }
    return messages;
  }
  async create(dto: SendMessageDto, senderId: string) {
    const key = `room:messages:${dto.roomId}`;

    let message = this.messageRepo.create({ ...dto, senderId, isRead: true });
    message = await this.messageRepo.save(message);
    await this.redisClient.rpush(key, JSON.stringify(message));
    return message;
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
