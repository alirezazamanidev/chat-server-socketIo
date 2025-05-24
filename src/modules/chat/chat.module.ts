import { Module } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../user/entities/user.entity';
import { Message } from './entities/message.entity';

import { MessageService } from './services/message.service';
import { UserModule } from '../user/user.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { Room } from './entities/room.entity';

import { ChatService } from './services/chat.service';
import { ChatGateway } from './gateway/chat.gateway';
@Module({
  imports: [
    TypeOrmModule.forFeature([Room, User, Message]),
    UserModule,
    CacheModule.registerAsync({
        useFactory:async () => {
            return {
                stores:[
                    createKeyv(`redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`),
                ]
            }
        }
      
    }),
  ],
  providers: [ChatService, ChatGateway, MessageService],
})
export class ChatModule {}
