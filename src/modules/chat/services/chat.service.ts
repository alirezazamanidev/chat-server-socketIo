import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { Repository, In, DataSource } from 'typeorm';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { AssignUsersDto, ChatDetailDto, CreateRoomDto } from '../dto/chat.dto';
import { MessageService } from './message.service';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';
import { RoomTypeEnum } from '../enums/type.enum';
import { WsNotFoundException } from 'src/common/exceptions';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly messageService: MessageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Chat) private readonly chatRepo: Repository<Chat>,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}
  async createChat(senderId: string, receiverId: string) {
    let chat = await this.chatRepo.findOne({
      where: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    });
    if (chat) {
      return chat;
    }
    chat = this.chatRepo.create({
      senderId,
      receiverId,
    });
    return await this.chatRepo.save(chat);
  }
  async removeChat(chatId: string) {
    const chat = await this.findChatById(chatId);
    if (chat?.messages?.length === 0) {
      await this.chatRepo.remove(chat);
    }
  }
  async findChatById(chatId: string) {
    const chat = await this.chatRepo.findOne({
      where: { id: chatId },
      relations: ['messages'],
    });
    if (!chat) {
      throw new WsNotFoundException('Chat not found');
    }
    return chat;
  }

  async findByUserId(userId: string) {
    return await this.chatRepo.find({
      where: [{ senderId: userId }, { receiverId: userId }],
      order: { created_at: 'DESC' },
      relations: ['messages'],
    });
  }
}
