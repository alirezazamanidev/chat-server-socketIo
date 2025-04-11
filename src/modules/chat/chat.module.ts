import { Module } from '@nestjs/common';
import { ChatService } from './services/chat.service';
import { ChatGateway } from './chat.gateway';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../user/entities/user.entity';
import { Message } from './entities/message.entity';

import { MessageService } from './services/message.service';
import { UserModule } from '../user/user.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Room } from './entities/room.entity';
import { RedisModule } from '../redis/redis.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([Room, User, Message]),
    UserModule,
    RedisModule.forRoot()
  ],
  providers: [ChatGateway, ChatService, MessageService],
})
export class ChatModule {}
