import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { Repository, In, DataSource } from 'typeorm';
import { Room } from '../entities/room.entity';
import { Message } from '../entities/message.entity';
import { MessageService } from './message.service';

import { Redis } from 'ioredis';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly messageService: MessageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  async findOneById(roomId:string){
    
  }

  async listOfRoom(userId: string) {
    const rooms = await this.roomRepo.createQueryBuilder('room')
      .leftJoinAndSelect('room.messages', 'message') // اتصال پیام‌ها به اتاق
      .leftJoinAndSelect('room.participants', 'participant') // اتصال شرکت‌کنندگان به اتاق
      .where('participant.id = :userId', { userId }) // بررسی که کاربر در اتاق است
      .andWhere('message.created_at IN (SELECT MAX(m.created_at) FROM message m WHERE m.roomId = room.id)') // پیدا کردن آخرین پیام بر اساس تاریخ
      .orderBy('message.created_at', 'DESC') // مرتب‌سازی بر اساس تاریخ پیام
      .getMany();

    // برای هر اتاق آخرین پیام را از لیست پیام‌ها پیدا می‌کنیم
    return rooms.map(room => {
      const lastMessage = room.messages.length > 0 ? room.messages[0] : null;
      return {
        ...room,
        lastMessage, // اضافه کردن آخرین پیام به اطلاعات اتاق
      };
    });
  }

  async setOneline(userId:string){
    await this.redisClient.set(`user:online:${userId}`,'true')
  }
  async setOffline(userId: string): Promise<void> {

    await this.redisClient.del(`user:online:${userId}`);
  }
  async isOnline(userId: string): Promise<boolean> {
    const value = await this.redisClient.get(`user:online:${userId}`);
    return value === 'true';
  }
}
