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
import { WsException } from '@nestjs/websockets';
import { RoomTypeEnum } from '../enums/type.enum';

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

  async findOneByIdGroup(roomId: string) {
    const room = await this.roomRepo.findOne({
      where: { id: roomId },
      relations: { participants: true },
      select: { participants: { id: true } },
    });
    if (!room) throw new WsException('room Not found!');
    // if(!room.participants.includes())
    return room;
  }
  async findOnePvRoom(
    userId: string,
    receiverId: string,
  ): Promise<Room | null> {
    if (!userId || !receiverId) {
      throw new BadRequestException('User ID and receiver ID are required');
    }
    if (userId === receiverId) {
      throw new BadRequestException('Cannot create a room with yourself');
    }
    try {
      const cachKey = `pv_room:${[userId, receiverId].sort().join(':')}`;
      const cachedRoom = await this.redisClient.get(cachKey);
      if (cachedRoom) {
        return JSON.parse(cachedRoom);
      }
      const room = await this.roomRepo
        .createQueryBuilder('room')
        .innerJoin('room.participants', 'p')
        .where('room.type = :type', { type: RoomTypeEnum.PV })
        .andWhere('p.id IN (:...ids)', { ids: [userId, receiverId] })
        .getOne();

      if (room) {
        await this.redisClient.setex(cachKey, 3600, JSON.stringify(room));
      }
      return room;
    } catch (error) {
      this.logger.error(`Error in findOnePvRoom: ${error.message}`);
      throw error;
    }
  }

  async createPvRoom(userId1: string, userId2: string): Promise<Room> {
    try {
      const [user1, user2] = await Promise.all([
        this.userRepo.findOneOrFail({ where: { id: userId1 }, select: ['id'] }),
        this.userRepo.findOneOrFail({ where: { id: userId2 }, select: ['id'] }),
      ]);

      const room = this.roomRepo.create({
        type: RoomTypeEnum.PV,
        participants: [user1, user2],
      });

      const savedRoom = await this.roomRepo.save(room);

      // کش کردن اتاق
      const cacheKey = `pv_room:${[userId1, userId2].sort().join(':')}`;
      await this.redisClient.setex(cacheKey, 3600, JSON.stringify(savedRoom));

      return savedRoom;
    } catch (error) {
      this.logger.error(`Error in createPvRoom: ${error.message}`);
      throw error instanceof NotFoundException
        ? error
        : new BadRequestException('Failed to create PV room');
    }
  }

  async setOneline(userId: string) {
    await this.redisClient.set(`user:online:${userId}`, 'true', 'EX', 60);
  }
  async setOffline(userId: string): Promise<void> {
    await this.redisClient.del(`user:online:${userId}`);
  }
  async isOnline(userId: string): Promise<boolean> {
    const value = await this.redisClient.get(`user:online:${userId}`);
    return value === 'true';
  }

  async findUserChats(userId: string) {
    try {
      // // چک کردن کش
      const cacheKey = `user_chats:${userId}`;
      const cachedChats = await this.redisClient.get(cacheKey);
      if (cachedChats) {
        return JSON.parse(cachedChats);
      }

      // گرفتن اتاق‌ها با اطلاعات مورد نیاز
      const rooms = await this.roomRepo
        .createQueryBuilder('room')
        .leftJoinAndSelect('room.participants', 'participant')
        .leftJoinAndSelect('room.lastMessage', 'lastMessage')
        .select([
          'room.id',
          'room.type',
          'room.name',
          'room.isActive',
         
          'participant.id',
          'participant.username',
          'participant.fullName',
          'participant.avatar',
          'lastMessage.id',
          'lastMessage.text',
          'lastMessage.created_at',
      
        ])
        .where('participant.id = userId', { userId })
        .andWhere('room.isActive = true')
        .getMany();
      // محاسبه اطلاعات چت‌ها
      const result = await Promise.all(
        rooms.map(async (room) => {
          // پیدا کردن کاربر مقابل در چت خصوصی
          const otherUser =
            room.type === RoomTypeEnum.PV
              ? room.participants.find((p) => p.id !== userId)
              : null;

          // گرفتن تعداد پیام‌های خوانده‌نشده
          const unreadCount = await this.getUnreadCount(room.id, userId);

          // بررسی وضعیت آنلاین
          const isOnline =
            room.type === RoomTypeEnum.PV && otherUser
              ? await this.isOnline(otherUser.id)
              : false;

          return {
            id: room.id,
            type: room.type,
            name: otherUser?.fullName || room.name || null,
            receiver:
              room.type === RoomTypeEnum.PV && otherUser
                ? {
                    id: otherUser.id,
                    username: otherUser.username,
                    fullName: otherUser.fullName,
                    avatar: otherUser.avatar || null,
                    isOnline,
                  }
                : undefined,
            lastMessage: room.lastMessage || null,
            unreadCount,
          };
        }),
      );

      // ذخیره در کش
      if (result.length !== 0) {
        await this.redisClient.setex(cacheKey, 3600, JSON.stringify(result));
      }
      return result;
    } catch (error) {
      this.logger.error(
        `Error in findUserChats: ${error.message}`,
        error.stack,
      );
      throw error instanceof BadRequestException ||
        error instanceof NotFoundException
        ? error
        : new BadRequestException('Failed to fetch user chats');
    }
  }
  async getOnlineStatuses(userIds: string[]): Promise<boolean[]> {
    return Promise.all(userIds.map((id) => this.isOnline(id)));
  }
  private async getUnreadCount(
    roomId: string,
    userId: string,
  ): Promise<number> {
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

    await this.redisClient.setex(cacheKey, 3600, count.toString());
    return count;
  }
}
