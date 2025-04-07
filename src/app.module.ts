import { Module } from '@nestjs/common';
import { appIntervalImports } from './app/imports/interval.import';
import { appExternalImports } from './app/imports/external.imports';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';

@Module({
  imports: [
    ...appIntervalImports,
    ...appExternalImports,
    AuthModule,
    ChatModule,
  ]
})
export class AppModule {}
