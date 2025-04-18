import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../user/entities/user.entity';
import { Message } from './entities/message.entity';

import { MessageService } from './services/message.service';
import { UserModule } from '../user/user.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Room } from './entities/room.entity';
import { RedisModule } from '../redis/redis.module';
import { PvChatGateway } from './gateway/private.gateway';
import { PvChatService } from './services/pvChat.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Room, User, Message]),
    UserModule,
    RedisModule.forRoot()
  ],
  providers: [PvChatService, PvChatGateway, MessageService],
})
export class ChatModule {}
