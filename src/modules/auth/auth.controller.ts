import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/user.dto';
import { SignInDto } from './dtos/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  
    async signUp(@Body() userDto: CreateUserDto) {
      return this.authService.signUp(userDto);
  }

  @Post('signin')
  async signIn(@Body() userDto: SignInDto) {
    return this.authService.signIn(userDto);
  }
}
