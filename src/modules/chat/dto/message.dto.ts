import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { RoomTypeEnum } from "../enums/type.enum";

export class SendMessageDto {

  @IsOptional()
  @IsUUID()
  roomId?:string
  @IsOptional()
  @IsUUID()
  receiverId?:string
  @IsEnum(RoomTypeEnum)
  type:string
  @IsNotEmpty()
  @IsString()
  text:string
}