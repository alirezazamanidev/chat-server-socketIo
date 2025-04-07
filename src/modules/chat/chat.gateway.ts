import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ChatService } from './services/chat.service';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';

import { WsUnauthorizedException } from '../../common/exceptions';
import { WsLoggingInterceptor } from '../../common/interceptors/ws-logging.interceptor';
import { isJWT } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { ConnectedUserService } from './services/connectced-user.service';
import { User } from '../user/entities/user.entity';

@UseFilters(WsExceptionFilter)
@UseInterceptors(WsLoggingInterceptor)
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);
  @WebSocketServer()
  server: Server;


  constructor(
    private readonly chatService: ChatService,
    private readonly connectedUserService: ConnectedUserService,
    private readonly jwtService: JwtService,
  ) {}


  async onModuleInit(){
    this.logger.log('ChatGateway initialized');
    await this.connectedUserService.deleteAll();
  }

  async handleConnection(client: Socket) {
   try {
    const user=await this.authenticateSocket(client)
    await this.in
   } catch (error) {
    
   }
  }


  private async initializeUserConnection(
    userPayload: User,
    socket: Socket,
  ): Promise<void> {
    socket.data.user = userPayload;
    await this.connectedUserService.create(userPayload.id, socket.id);

    const rooms = await this.chatService.findByUserId(userPayload.id);
    this.server.to(socket.id).emit('userAllRooms', rooms);
    this.logger.log(
      `Client connected: ${socket.id} - User ID: ${userPayload.id}`,
    );
  }
  async handleDisconnect(client: Socket) {
    const userId = this.socketUserMap.get(client.id);

    if (userId) {
      this.userSocketMap.delete(userId);
      this.socketUserMap.delete(client.id);
      client.leave(`user_${userId}`);
      this.logger.log(`Client disconnected: ${client.id}, User: ${userId}`);
    }
  }


  private authenticateSocket(client: Socket) {
    const authHeader = client.handshake.headers?.['authorization'];
    if (!authHeader)
      throw new WsUnauthorizedException(
        'Invalid or missing authentication token',
      );

    const [bearer, token] = authHeader.split(' ');

    if (!token || bearer.toLocaleLowerCase() !== 'bearer')
      throw new WsUnauthorizedException(
        'Invalid authorization format. Use Bearer token',
      );

    if (!token || !isJWT(token))
      throw new WsUnauthorizedException('Invalid token format');

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      return payload;
    } catch (error) {
      throw new WsUnauthorizedException('Invalid token: ' + error.message);
    }
  }

  private handleConnectionError(socket: Socket, error: Error): void {
    this.logger.error(
      `Connection error for socket ${socket.id}: ${error.message}`,
    );
    socket.emit('exception', 'Authentication error');
    socket.disconnect();
  }
}
