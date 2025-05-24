import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Message } from '../entities/message.entity';
import { CreateMessageDto, SendMessageDto } from '../dto/message.dto';
import { Room } from '../entities/room.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class MessageService {
  private readonly MAX_MESSAGES = 50;
  private readonly CACHE_TTL = 3600; // 1 ساعت
  private readonly logger = new Logger(MessageService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Room)
    private readonly roomRepo: Repository<Room>,

    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async recentMessages(roomId: string): Promise<Message[]> {
    const cacheKey = `chat:recentMessages:${roomId}`;
    const cachedMessages = await this.cacheManager.get<Message[]>(cacheKey);
    if (cachedMessages) {
      return cachedMessages;
    }

    const messages = await this.messageRepo.find({
      where: { roomId },
      order: { created_at: 'DESC' },
      take: this.MAX_MESSAGES,
    });

    await this.cacheManager.set(cacheKey, messages, this.CACHE_TTL);
    return messages;
  }

  async createMessage(
    roomId: string,
    text: string,
    senderId: string,
  ): Promise<Message> {
    let message = this.messageRepo.create({ roomId, text, senderId });
    message = await this.messageRepo.save(message);
    // update lastMessage room
    // TODO change to Ioredis
    await this.roomRepo.update({ id: roomId }, { lastMessage: message });
    const catchedMessages = await this.cacheManager.get<Message[]>(
      `chat:recentMessages:${roomId}`,
    );
    catchedMessages?.push(message);
    await this.cacheManager.set(
      `chat:recentMessages:${roomId}`,
      catchedMessages,
    );
    return message;
  }
}
