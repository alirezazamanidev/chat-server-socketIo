import { Controller, Post, Body, UseInterceptors, UploadedFile } from '@nestjs/common';
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
      new FileValidationPipe({
        maxSize: 1024 * 1024 * 2,
        allowedTypes: ['image/jpeg', 'image/png', 'image/jpg']
      })
    ) avatar: Express.Multer.File) {
      return this.authService.signUp(userDto,avatar);
  }

  @Post('signin')
  async signIn(@Body() userDto: SignInDto) {
    return this.authService.signIn(userDto);
  }
}
