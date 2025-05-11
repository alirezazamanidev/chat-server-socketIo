import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Message } from '../entities/message.entity';
import { SendMessageDto } from '../dto/message.dto';
import { Room } from '../entities/room.entity';

@Injectable()
export class MessageService {
  private readonly MAX_MESSAGES = 50;
  private readonly CACHE_TTL = 3600; // 1 ساعت
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Room) private readonly roomRepo:Repository<Room>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async getRecnetMessages(roomId: string) {
    await this.messageRepo
    .createQueryBuilder()
    .update()
    .set({ isRead: true })
    .where('roomId = :roomId AND isRead = false', { roomId })
    .execute();
    const messages= await this.messageRepo.find({where:{roomId},order:{created_at:'ASC'}});
    return messages;
  }
  async seenMessage(msgId:string){
    return this.messageRepo.update({id:msgId,isRead:false},{isRead:true})
  }

  async create({ text, roomId, senderId }: { text: string, roomId: string, senderId: string }) {
    let message = this.messageRepo.create({
      text,
      roomId,
      senderId,
    });
    message=await this.messageRepo.save(message);
    await this.roomRepo.update({id:roomId},{lastMessage:message});
    return message
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
