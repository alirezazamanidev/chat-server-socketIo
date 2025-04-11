import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class SendMessageDto {

  @IsNotEmpty()
  @IsUUID()
  roomId?:string
  
  @IsNotEmpty()
  @IsString()
  text:string
}