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

  async findOneRoom(
    receiverId: string,
    senderId: string,
  ): Promise<{ room: Room | null; receiver: User }> {
    const [ids1, ids2] = [receiverId, senderId].sort();
    const cacheKey = `chat:room:${ids1}:${ids2}`;
    const cachedRoom = await this.cacheManager.get<Room>(cacheKey);
    const room =
      cachedRoom ??
      (await this.roomRepo.findOne({
        where: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
        relations: ['receiver'],
      }));

    const receiver = await this.userRepo.findOne({
      where: { id: receiverId },
      select: ['id', 'fullName', 'username', 'avatar', 'avatar'],
    });
    if (!receiver) {
      throw new NotFoundException('Receiver not found');
    }

    if (room && !cachedRoom) {
      await this.cacheManager.set(cacheKey, room, 3600); // Cache for 1 hour
    }

    return { room: room ?? null, receiver };
  }
  async create(senderId:string,receiverId:string):Promise<Room>{
    let room=this.roomRepo.create({receiverId,senderId});
    return await this.roomRepo.save(room)
  }
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
