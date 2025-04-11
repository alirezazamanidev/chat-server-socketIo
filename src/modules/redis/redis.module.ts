// redis.module.ts
import { Module, DynamicModule } from '@nestjs/common';
import { Redis } from 'ioredis';

@Module({})
export class RedisModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_CLIENT',
          useFactory: () => {
            return new Redis({
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              lazyConnect: true,
            });
          },
        },
      ],
      exports: ['REDIS_CLIENT'], // فقط redisClient رو صادر می‌کنیم
    };
  }
}