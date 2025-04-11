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

}
