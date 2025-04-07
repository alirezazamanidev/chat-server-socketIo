import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";

export class FilterMessageDto {

    first?: number;
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    rows?: number;
    @IsString()
    @IsOptional()
    filter?: string;
  
   
    @IsUUID()
    @IsString()
    @IsNotEmpty()
    chatId: string;
  }
  