import { Module } from '@nestjs/common';
import { appIntervalImports } from './app/imports/interval.import';
import { appExternalImports } from './app/imports/external.imports';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    ...appIntervalImports,
    ...appExternalImports,
    AuthModule,
    ChatModule,
    RedisModule,
  ]
})
export class AppModule {}
