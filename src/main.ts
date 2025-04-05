import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { appInit } from './app';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
   appInit(app);
  await app.listen(process.env.PORT ?? 8000,()=>{
    console.log(`Server is running on port ${process.env.PORT ?? 8000}`);
  });
}
bootstrap();
