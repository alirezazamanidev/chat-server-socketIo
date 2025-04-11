import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { RoomTypeEnum } from '../enums/type.enum';

export class JoinRoomDto {
  @IsNotEmpty()
  @IsUUID()
  roomId: string;

}
export class CreateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;
  @IsNotEmpty()
  @IsEnum(RoomTypeEnum)
  type: string;
  @IsNotEmpty()
  @IsArray()
  @IsUUID('4',{each:true})
  members: string[];
}
export class AssignUsersDto {
  @IsUUID()
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsArray()
  @IsString({ each: true })
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  members: string[];
}