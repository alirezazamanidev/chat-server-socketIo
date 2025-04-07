import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { ILike, Repository } from 'typeorm';
import { WsException } from '@nestjs/websockets';
import { FilterMessageDto } from '../dto/message.dto';
import { TResultAndCount } from 'src/common/@types/result-and-count.type';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}
  private readonly logger=new Logger(MessageService.name)

  async findByRoomId(
    filterMessageDto: FilterMessageDto,
  ): Promise<TResultAndCount<Message>> {
    const { first = 0, rows = 20, filter = '', chatId } = filterMessageDto;

    try {
      const [result, total] = await this.messageRepo.findAndCount({
        where: { text: ILike(`%${filter}%`), chatId },
        relations: ['sender'],
        order: { created_at: 'DESC' },
        take: rows,
        skip: first,
      });

      const sanitizedMessages = result.map((message) => {
        const { sender } = message;
        const { hashPassword, ...sanitizedCreator } = sender;
        return { ...message, sender: sanitizedCreator };
      });

      return { result: sanitizedMessages, total };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve messages for room ID ${chatId}: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw new WsException(
          error.message || 'The requested resource was not found.',
        );
      }

      if (error instanceof WsException) {
        throw error;
      }

      throw new WsException(
        'An error occurred while fetching messages. Please try again later.',
      );
    }
  }

}
