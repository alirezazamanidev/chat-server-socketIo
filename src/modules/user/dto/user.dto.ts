import { IsString, IsNotEmpty, Length, Matches, IsAlphanumeric, MinLength } from "class-validator";

export class CreateUserDto {
    @IsString({ message: 'Full name must be a string' })
    @IsNotEmpty({ message: 'Full name is required' })
    @Length(3, 100, { message: 'Full name must be between 3 and 100 characters' })
    fullName: string;

    @IsString({ message: 'Username must be a string' })
    @IsNotEmpty({ message: 'Username is required' })
    @Length(3, 50, { message: 'Username must be between 3 and 50 characters' })
  
    username: string;

    @IsString({ message: 'Password must be a string' })
    @IsNotEmpty({ message: 'Password is required' })
    @MinLength(8, { message: 'Password must be at least 8 characters long' })
    password: string;
    @IsNotEmpty()
    avatar:Express.Multer.File
}