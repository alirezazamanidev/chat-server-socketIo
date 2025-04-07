import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsNotEmpty } from 'class-validator';
import { ChatType } from '../enums/type.enum';
import { Transform } from 'class-transformer';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';

export class CreateRoomDto {
  @IsEnum(ChatType)
  @Transform(({ value }) => value.toString())
  @IsNotEmpty()
  type: ChatType;

  @IsString()
  @IsOptional()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsUUID(undefined, {
    each: true,
    message: 'Each participant must be a valid UUID',
  })
  @IsNotEmpty()
  participants: string[];
}

export class ChatDetailDto extends Chat {
    lastMessage: Message;
  }
  