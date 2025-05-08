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


  async setOneline(userId:string){
    await this.redisClient.set(`user:${userId}:online`,'true')
  }
  async setOffline(userId: string): Promise<void> {
    await this.redisClient.del(`user:${userId}:online`);
  }
  async isOnline(userId: number): Promise<boolean> {
    const value = await this.redisClient.get(`user:${userId}:online`);
    return value === 'true';
  }
}
