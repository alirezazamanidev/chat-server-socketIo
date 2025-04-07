import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../user/entities/user.entity';
import { Repository, In } from 'typeorm';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { ChatType } from '../enums/type.enum';
import { ChatDetailDto } from '../dto/chat.dto';
import { MessageService } from './message.service';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class ChatService {
  private readonly logger=new Logger(ChatService.name);

  constructor(
    private readonly messageService:MessageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Chat) private readonly chatRepo: Repository<Chat>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>
  ) {}

  async findByUserId(userId: string): Promise<ChatDetailDto[]> {
    try {
      const chats = await this.chatRepo
        .createQueryBuilder('chat')
        .innerJoin(
          'chat.participants',
          'participant',
          'participant.id = :userId',
          { userId },
        )
        .leftJoinAndSelect('room.participants', 'allParticipants')
        .getMany();

      const chatDetailsList: ChatDetailDto[] = [];

      for (const chat of chats) {
        const lastMessageResult = await this.messageService.findByRoomId({
          chatId:chat.id,
          first: 0,
          rows: 1,
        });

        const chatDetail = plainToInstance(ChatDetailDto, {
          ...chat,
          lastMessage: lastMessageResult.total
            ? lastMessageResult.result[0]
            : null,
          participants: chat.participants,
        });

        chatDetailsList.push(chatDetail);
      }

      return chatDetailsList
    } catch (error) {
      this.logger.error(
        `Failed to find rooms for user ID ${userId}: ${error.message}`,
        { userId, errorStack: error.stack },
      );
      throw new WsException(
        'An error occurred while retrieving user rooms. Please try again later.',
      );
    }
  }


}
