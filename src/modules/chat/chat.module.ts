import { Module } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entities/chat.entity';
import { User } from '../user/entities/user.entity';
import { Message } from './entities/message.entity';

import { MessageService } from './services/message.service';
import { UserModule } from '../user/user.module';
@Module({
  imports:[TypeOrmModule.forFeature([Chat,User,Message]),UserModule],
  providers: [ChatGateway, ChatService,MessageService],
})
export class ChatModule {}
