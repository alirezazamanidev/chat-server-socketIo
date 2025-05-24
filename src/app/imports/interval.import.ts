import { AuthModule } from 'src/modules/auth/auth.module';
import { ChatModule } from 'src/modules/chat/chat.module';
import { UserModule } from 'src/modules/user/user.module';

export const appIntervalImports = [UserModule, AuthModule, ChatModule];
