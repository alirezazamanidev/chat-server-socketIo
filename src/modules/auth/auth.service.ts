import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CreateUserDto } from '../user/dto/user.dto';
import { JwtService } from '@nestjs/jwt';
import { SignInDto } from './dtos/auth.dto';
import { compare } from 'bcrypt';
@Injectable()
export class AuthService {
    constructor(private userService: UserService,private jwtService: JwtService){}

    async signUp(userDto: CreateUserDto){
        
      const user = await this.userService.createUser(userDto);
      const payload = {username: user.username, sub: user.id};
      return {
        success: true,
        jwtToken: this.jwtService.sign(payload),
      };

    }
    async signIn(userDto: SignInDto){
        const {username, password} = userDto;
        const user = await this.userService.findByUsername(username);
        if(!user || !(await compare(password, user.hashPassword))){
            throw new UnauthorizedException('Invalid credentials');
        }
        const payload = {username: user.username, sub: user.id};
        return {
            success: true,
            jwtToken: this.jwtService.sign(payload),
        };
    }
}
