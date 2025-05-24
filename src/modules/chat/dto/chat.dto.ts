import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
export class JoinRoomDto {
  
  @IsNotEmpty()
  @IsUUID()
  receiverId:string
}
