import { Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayInit,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from 'src/modules/auth/types/payload.type';
import { MessageService } from '../services/message.service';
import { UserService } from 'src/modules/user/user.service';
import { ChatService } from '../services/chat.service';
import { isJWT } from 'class-validator';
import { JoinRoomDto } from '../dto/chat.dto';

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  private server: Server;

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private chatService: ChatService,
    private messageService: MessageService,
  ) {}
  async handleConnection(client: Socket) {
    try {
      const payload = this.authenticateSocket(client);
      client.data.user = payload;
      await this.chatService.setOnelineChat(payload.id);
      client.join(`user_${payload.id}`);
      client.emit('online-status-user', { userId: payload.id, isOnline: true });
      // const rooms = await this.chatService.findUserChats(payload.id);
      // this.server.to(`user_${payload.id}`).emit('chatList', rooms);
      this.logger.log(
        `Client Connected userId: ${payload.id} socketId: ${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.user?.id;
      if (userId) {
        await this.chatService.setOfflineChat(userId);
        client.leave(`user_${userId}`);
        this.server.emit('online-status-user', {
          userId,
          isOnline: false,
          lastSeen: new Date(),
        });
        this.logger.log(`User ${userId} disconnected and cleaned up`);
      }
    } catch (error) {
      this.logger.error(`Error in disconnect: ${error.message}`);
    }
  }

  @SubscribeMessage('get-user-list')
  async getUsers(@ConnectedSocket() client: Socket) {
    try {
      const users = await this.userService.findAll();
      return users;
    } catch (error) {
      this.logger.error(`Error in getUsers: ${error.message}`);
      throw new WsException('Failed to fetch users');
    }
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() { receiverId }: JoinRoomDto,
  ) {
    try {
      const userId = client.data.user?.id;
      if (!userId) {
        throw new UnauthorizedException('User not authenticated');
      }
      const { receiver, room } = await this.chatService.findOneRoom(
        receiverId,
        userId,
      );
      if (room) {
        const messages = await this.messageService.recentMessages(room.id);
        client.join(`room_${room.id}`);
        this.logger.log(`User ${userId} joined room ${room.id}`);
        this.server.to(`room_${room.id}`).emit('messages', messages);
      }

      client.emit('roomInfo', { ...receiver });
    } catch (error) {
      this.logger.error(`Error in joinRoom: ${error.message}`);
      throw new WsException('Failed to join room');
    }
  }

  private authenticateSocket(socket: Socket): JwtPayload {
    try {
      const token = this.extractJwtToken(socket);
      return this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractJwtToken(socket: Socket): string {
    const authHeader = socket.handshake.headers.authorization;
    if (!authHeader)
      throw new UnauthorizedException('No authorization header found');
    const [bearer, token] = authHeader.split(' ');
    if (bearer.toLowerCase() !== 'bearer' || !token || !isJWT(token)) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    return token;
  }
}
