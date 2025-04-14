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
import {
  WsBadRequestException,
  WsNotFoundException,
} from 'src/common/exceptions';
import { RoomTypeEnum } from '../enums/type.enum';
import { AssignUsersDto, CreateRoomDto, JoinRoomDto } from '../dto/chat.dto';
import { WsException } from '@nestjs/websockets';
import { Redis } from 'ioredis';

@Injectable()
export class PvChatService {
  private readonly logger = new Logger(PvChatService.name);

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

  async getOrCreateRoom(joinRoomDto: JoinRoomDto, userId: string) {
    const { reciverId } = joinRoomDto;
    let room = await this.roomRepo
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'p1', 'p1.id = :userId', { userId })
      .innerJoin('room.participants', 'p2', 'p2.id = :reciverId', { reciverId })
      .innerJoinAndSelect('room.participants', 'participants')
      .select([
        'room.id',
        'room.type',
        'room.name',
        'room.isActive',
        'room.created_at',
        'participants.id',
        'participants.username',
        'participants.avatar',
        'participants.fullName',
      ])
      .where('room.type = :type', { type: RoomTypeEnum.PV })
      .getOne();
    if (room) {
      const receiver = room.participants.find((p) => p.id !== userId);
     
      room['receiver'] = receiver;
      return room;
    }
    const sender = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id'],
    });
    const receiver = await this.userRepo.findOne({
      where: { id: reciverId },
      select: ['id', 'username', 'avatar','fullName'],
    });
    if (!sender) throw new NotFoundException('sender not founded');
    if (!receiver) throw new NotFoundException('reciver not founded');
    room = this.roomRepo.create({
      type: RoomTypeEnum.PV,
      isActive: true,

      participants: [sender, receiver],
    });
    room = await this.roomRepo.save(room);

    room['receiver'] = receiver;
    return room;
  }
}
