import { InjectRepository } from '@nestjs/typeorm';
import { ConnectedUser } from '../entities/connected-user.entity';
import { Repository } from 'typeorm';
import { WsException } from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConnectedUserService {
    private readonly logger=new Logger(ConnectedUserService.name)
  constructor(
    @InjectRepository(ConnectedUser)
    private readonly connectedUserRepo: Repository<ConnectedUser>,
  ) {}

  async create(userId: string, socketId: string): Promise<ConnectedUser> {
    try {
      const newUserConnection = this.connectedUserRepo.create({
        userId,
        socketId,
      });
      return await this.connectedUserRepo.save(newUserConnection);
    } catch (ex) {
      this.logger.error(
        `Failed to create a connected user for userId: ${userId}`,
        ex.stack,
      );
      throw new WsException('Error creating new user connection.');
    }
  }
  async delete(socketId: string) {
    try {
      return await this.connectedUserRepo.delete({ socketId });
    } catch (ex) {
      this.logger.error(
        `Failed to delete the connected user with socketId: ${socketId}`,
        ex.stack,
      );
      throw new WsException('Error removing user connection.');
    }
  }
  async deleteAll(): Promise<void> {
    try {
      await this.connectedUserRepo
        .createQueryBuilder('connectedUser')
        .delete()
        .execute();
    } catch (ex) {
      this.logger.error('Failed to clear the connected user table', ex.stack);
      throw new WsException('Error clearing all user connections.');
    }
  }
}
