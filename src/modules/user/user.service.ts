import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/user.dto';
import { hash } from 'bcrypt';
import { ConflictException } from '@nestjs/common';

export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: ['id', 'avatar', 'username', 'fullName'],
    });
  }
  async createUser(
    userDto: CreateUserDto,
    file: Express.Multer.File,
  ): Promise<User> {
    const { password, username, ...userData } = userDto;
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }
    const hashPassword = await hash(password, 10);
    const user = this.userRepository.create({
      ...userData,
      hashPassword,
      username,
      avatar: file?.path,
    });
    return this.userRepository.save(user);
  }
  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { username } });
  }
  async findAll() {
    return this.userRepository.find({
      select: {
        id: true,
        username: true,
        fullName: true,
        created_at: true,
        avatar: true,
      },
      order: { created_at: 'DESC' },
    });
  }
}
