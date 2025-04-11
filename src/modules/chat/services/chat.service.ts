import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { Repository, In, DataSource } from 'typeorm';
import { Room } from '../entities/room.entity';
import { Message } from '../entities/message.entity';
import { MessageService } from './message.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  WsBadRequestException,
  WsNotFoundException,
} from 'src/common/exceptions';
import { RoomTypeEnum } from '../enums/type.enum';
import { AssignUsersDto, CreateRoomDto, JoinRoomDto } from '../dto/chat.dto';
import { WsException } from '@nestjs/websockets';
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

  async findOneById(roomDto: JoinRoomDto, userId: string) {

    const { roomId } = roomDto;
    const room = await this.roomRepo
      .createQueryBuilder('room')
      .innerJoin(
        'room.participants',
        'participant',
        'participant.id = :userId',
        { userId },
      )
      .where('room.id = :roomId', { roomId })
      .getOne();
    if (!room) throw new WsNotFoundException('room not found!');

    return room;
  }
  async createRoom(dto: CreateRoomDto, userId: string): Promise<Room> {
    const { type, members, name } = dto; 
    try {
      // اعتبارسنجی نوع روم و اعضا
      this.validateRoomTypeAndParticipants(type, members, userId);
  
      if (type === RoomTypeEnum.PV) {
        const otherUserId = members[0];
        
        // چک کردن وجود روم قبلی بین این دو کاربر
        const existingRoom = await this.roomRepo
          .createQueryBuilder('room')
          .innerJoin('room.participants', 'p1', 'p1.id = :userId', { userId })
          .innerJoin('room.participants', 'p2', 'p2.id = :otherUserId', { otherUserId })
          .where('room.type = :type', { type: RoomTypeEnum.PV })
          .getOne();
  
        if (existingRoom) {
          this.logger.log(`Existing PV room ${existingRoom.id} found for users ${userId} and ${otherUserId}`);
         
          return existingRoom; // برگرداندن روم موجود
        }
      }
  
      // ساخت روم جدید اگه روم قبلی وجود نداشت یا نوع روم گروهی بود
      const newRoom = this.roomRepo.create({
        type,
        name,
      });
      const savedRoom = await this.roomRepo.save(newRoom);
  
      if (members?.length > 0) {
        const membersWithOwner = [...members, userId];
        await this.assignUsersToRoom(
          {
            roomId: savedRoom.id,
            members: membersWithOwner,
          },
          
        );
      }
      this.logger.log(`Room ${savedRoom.id} created by User: ${userId}`);
      return savedRoom;
  
    } catch (error) {
   
      this.logger.error(`Failed to create room: ${error.message}`, error.stack);
      throw new WsBadRequestException('Error occurred while creating room');

    }
  }

  private async assignUsersToRoom(

    assignUsersDto: AssignUsersDto,
  ): Promise<void> {
    try {
      const { roomId, members } = assignUsersDto;
      
      // Find the room
      const room = await this.roomRepo.findOne({
        where: { id: roomId },
        relations: ['participants'],
      });
      
      if (!room) {
        throw new WsNotFoundException(`Room with ID ${roomId} not found`);
      }
      
      // Find all users to be added to the room
      const users = await this.userRepo.find({
        where: { id: In(members) },
      });
      
      if (users.length !== members.length) {
        throw new WsBadRequestException('One or more users not found');
      }
      
      const operationType = room.participants.length > 0 ? 're-assigned' : 'assigned';
      
      // Update the room's participants
      room.participants = users;
      await this.roomRepo.save(room);
      
      this.logger.log(
        `Users ${operationType} to room ${roomId} successfully.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to assign users to room: ${error.message}`,
        error.stack,
      );
      throw new WsException(
        `Failed to assign users to the room: ${error.message}`,
      );
    }
  }
  async validateRoomTypeAndParticipants(
    type: string,
    members: string[],
    userId: string,
  ) {
    if (members.includes(userId))
      throw new WsBadRequestException(
        'The room owner or updater should not be included in the participants list.',
      );
    if (type === RoomTypeEnum.PV && members.length !== 1)
      throw new WsBadRequestException(
        'Direct chat must include exactly one participant aside from the room owner or updater.',
      );
    
      if (type === RoomTypeEnum.GROUP && members.length < 1) {
        throw new WsBadRequestException(
          'Group chat must include at least one participant aside from the room owner or updater.',
        );
      }
      const uniqueMemberIds=new Set(members);
      if(uniqueMemberIds.size!==members.length)
        throw new WsBadRequestException('The participants list contains duplicates.');
  }

  private async updateChatCache(userId: string) {
    const cacheKey = `rooms:user:${userId}`;
    const chats = await this.roomRepo
      .createQueryBuilder('room')
      .innerJoin(
        'room.participants',
        'participant',
        'participant.id = :userId',
        { userId },
      )
      .leftJoinAndSelect('room.participants', 'participants')
      .leftJoinAndSelect('room.messages', 'messages')
      .orderBy('room.updated_at', 'DESC')
      .getMany();
    await this.redisClient.set(cacheKey, JSON.stringify(chats), 'EX', 3600);
  }
  async getUserChats(userId: string) {
    const cacheKey = `rooms:user:${userId}`;
    let chats = await this.redisClient.get(cacheKey);
    
    if (chats) {
      return JSON.parse(chats);
    } else {
      const roomData = await this.roomRepo
        .createQueryBuilder('room')
        .innerJoin(
          'room.participants',
          'participant',
          'participant.id = :userId',
          { userId },
        )
        .leftJoinAndSelect('room.participants', 'participants')
        .leftJoinAndSelect('room.messages', 'messages')
        .orderBy('room.updated_at', 'DESC')
        .getMany();
      
      await this.redisClient.set(cacheKey, JSON.stringify(roomData), 'EX', 3600);
      return roomData;
    }
  }

  async setUserOnline(userId: string, isOnline: boolean) {
    const key = `user:status:${userId}`;
    await this.redisClient.set(key, isOnline ? '1' : '0', 'EX', 3600);
  }
  async isUserOnline(userId: string): Promise<boolean> {
    const key = `user:status:${userId}`;
    const status = await this.redisClient.get(key);
    return status === '1';
  }
}
