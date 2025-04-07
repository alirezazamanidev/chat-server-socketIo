import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { IsNotEmpty } from 'class-validator';

import { Transform } from 'class-transformer';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { RoomTypeEnum } from '../enums/type.enum';

export class CreateRoomDto {
  @IsEnum(RoomTypeEnum)
  @Transform(({ value }) => value.toString())
  @IsNotEmpty()
  type: RoomTypeEnum;
  @IsString()
  @IsOptional()
  key: string;

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

export class AssignUsersDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsArray()
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  participants: string[];
}
