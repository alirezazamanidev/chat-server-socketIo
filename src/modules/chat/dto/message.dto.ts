import { Type } from "class-transformer";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
export class SendMessageDto {
  @IsNotEmpty()
  @IsUUID()
  receiverId:string
  
  @IsNotEmpty()
  @IsString()
  text:string
}
export class CreateMessageDto{
  @IsNotEmpty()
  @IsUUID()
  roomId:string
  @IsNotEmpty()
  @IsString()
  text:string
  @IsNotEmpty()
  @IsUUID()
  senderId:string
}