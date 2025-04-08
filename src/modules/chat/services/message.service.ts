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

  async createMessage(senderId:string,chatId:string,text:string){
    let message=this.messageRepo.create({
      senderId,
      chatId,
      text
    })
    message=await this.messageRepo.save(message)
    const completeMessage=await this.messageRepo.findOne({
      where:{id:message.id},
      relations:['sender']
    })
    return completeMessage
  }

}
