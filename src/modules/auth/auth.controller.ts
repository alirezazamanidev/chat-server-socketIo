import { Controller, Post, Body, UseInterceptors, UploadedFile, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/user.dto';
import { SignInDto } from './dtos/auth.dto';
import { UploadFile } from 'src/common/interceptors/upload-file.interceptor';
import { FileValidationPipe } from 'src/common/pipes/file-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseInterceptors(UploadFile('avatar', 'users'))
    async signUp(@Body() userDto: CreateUserDto, @UploadedFile(
   
    ) avatar: Express.Multer.File) {

      return this.authService.signUp(userDto,avatar);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() userDto: SignInDto) {
    return this.authService.signIn(userDto);
  }
}
