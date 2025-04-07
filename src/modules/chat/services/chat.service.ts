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

@Injectable()
export class ChatService {
  private readonly logger=new Logger(ChatService.name);

  constructor(
    private readonly dataSource:DataSource,
    private readonly messageService:MessageService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Chat) private readonly chatRepo: Repository<Chat>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>
  ) {}

  async create(userId: string, createRoomDto: CreateRoomDto): Promise<Chat> {
    const { participants, ...roomDetails } = createRoomDto;

    try {
      const newRoom = this.chatRepo.create({
        ...roomDetails,
        createdBy: userId,
       
      });
      const savedRoom = await this.chatRepo.save(newRoom);

      if (participants && participants.length > 0) {
        participants.push(userId);
        await this.assignUsersToRoom(userId, {
          chatId: savedRoom.id,
          participants,
        });
      }

      this.logger.log(
        `Room with ID ${savedRoom.id} created successfully by User ID: ${userId}`,
      );
      return savedRoom;
    } catch (error) {
      this.logger.error(`Failed to create room: ${error.message}`, error.stack);
      throw new WsException('Error occurred while creating the room.');
    }
  }

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
        .leftJoinAndSelect('chat.participants', 'allParticipants')
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


  private async assignUsersToRoom(
    userId: string,
    assignUsersDto: AssignUsersDto,
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const chat = await manager.findOne(
          Chat,
          {
            where: { id: assignUsersDto.chatId },
            relations: ['participants']
          },
        );
        
        if (!chat) {
          throw new WsException('Chat not found');
        }
        
        const operationType = chat.participants.length > 0 ? 're-assigned' : 'assigned';

        // Remove existing participants
        chat.participants = [];
        await manager.save(chat);

        // Get user entities for all participants
        const users = await manager.findBy(User, {
          id: In(assignUsersDto.participants)
        });

        // Assign new participants
        chat.participants = users;
        await manager.save(chat);

        this.logger.log(
          `Users ${operationType} to chat ${assignUsersDto.chatId} successfully.`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to assign users to chat: ${error.message}`,
        error.stack,
      );
      throw new WsException(
        `Failed to assign users to the chat: ${error.message}`,
      );
    }
  }
}
