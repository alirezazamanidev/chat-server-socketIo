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
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

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
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}
  async setOnelineChat(userId: string): Promise<void> {
    await this.cacheManager.set(`chat:online:${userId}`, true, 3600); // 1 hour

  }
  async setOfflineChat(userId: string): Promise<void> { 
    await this.cacheManager.del(`chat:online:${userId}`);
  }
  async isOnlineChat(userId: string): Promise<boolean> {
    const isOnline = await this.cacheManager.get(`chat:online:${userId}`);
    return !!isOnline;
  }
}
