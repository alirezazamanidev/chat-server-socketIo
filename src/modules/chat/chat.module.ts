import { Module } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entities/chat.entity';
import { User } from '../user/entities/user.entity';
import { Message } from './entities/message.entity';
import { ConnectedUserService } from './services/connectced-user.service';
import { ConnectedUser } from './entities/connected-user.entity';
import { MessageService } from './services/message.service';
import { UserModule } from '../user/user.module';
@Module({
  imports:[TypeOrmModule.forFeature([Chat,User,Message,ConnectedUser]),UserModule],
  providers: [ChatGateway, ChatService,ConnectedUserService,MessageService],
})
export class ChatModule {}
