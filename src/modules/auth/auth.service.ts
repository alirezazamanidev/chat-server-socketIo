import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/user.dto';
import { JwtService } from '@nestjs/jwt';
import { SignInDto } from './dtos/auth.dto';
import { compare } from 'bcrypt';
import { unlinkSync } from 'fs';
@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async signUp(userDto: CreateUserDto, avatar: Express.Multer.File) {
    try {
      const user = await this.userService.createUser(userDto, avatar);
      const payload = { username: user.username, id: user.id };
      return {
        userId: user.id,
        success: true,
        jwtToken: this.jwtService.sign(payload,{
          secret: process.env.JWT_SECRET,
          expiresIn: '7d',
        }),
      };
    } catch (error) {
      if (avatar) {
        unlinkSync(avatar.path);
      }
      throw new InternalServerErrorException(error);
    }
  }
  async signIn(userDto: SignInDto) {
    const { username, password } = userDto;
    const user = await this.userService.findByUsername(username);
    if (!user || !(await compare(password, user.hashPassword))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { username: user.username, id: user.id };
    return {
      userId: user.id,
      success: true,
      jwtToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
      }),
    };
  }
}
