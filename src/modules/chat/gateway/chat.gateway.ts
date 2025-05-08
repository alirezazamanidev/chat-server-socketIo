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
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from 'src/modules/auth/types/payload.type';
import { MessageService } from '../services/message.service';
import { UserService } from 'src/modules/user/user.service';
import { ChatService } from '../services/chat.service';
import { isJWT } from 'class-validator';
@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  private server: Server;
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private chatService:ChatService,
    private messageService: MessageService,
    
  ) {}

  async handleConnection(client:Socket) {
    try {
      const payload=this.authenticateSocket(client);
      client.data.user=payload;
      await this.chatService.setOneline(payload.id);
      client.join(`user_${payload.id}`);
      this.logger.log(`Client Connected userId : ${payload.id} socketId:${client.id}`)
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.disconnect()
    }
  }
  async handleDisconnect(client: Socket) {
    await this.chatService.setOffline(client.data.user?.id);
    client.leave(`user_${client.data.user.id}`);
    this.logger.log(`User ${client.data.user.id} disconnected and cleaned up`);
  }
  private authenticateSocket(socket: Socket): JwtPayload {
    const token = this.extractJwtToken(socket);    
    return this.jwtService.verify<JwtPayload>(token, {
      secret: process.env.JWT_SECRET,
    });
  }
  private extractJwtToken(socket: Socket): string {
    const authHeader = socket.handshake.headers.authorization;
    if (!authHeader)
      throw new UnauthorizedException('No authorization header found');
    const [bearer, token] = authHeader.split(' ');
    if (bearer.toLocaleLowerCase() !== 'bearer' || !token || !isJWT(token))
      throw new UnauthorizedException('Invalid or missing token');

    return token;
  }
}
