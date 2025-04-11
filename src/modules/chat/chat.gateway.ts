import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { ChatService } from './services/chat.service';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UseInterceptors } from '@nestjs/common';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter';

import { WsUnauthorizedException } from '../../common/exceptions';
import { WsLoggingInterceptor } from '../../common/interceptors/ws-logging.interceptor';
import { isJWT } from 'class-validator';
import { JwtService } from '@nestjs/jwt';

import { User } from '../user/entities/user.entity';
import { JwtPayload } from '../auth/types/payload.type';
import { UserService } from '../user/user.service';
import { MessageService } from './services/message.service';
import { SendMessageDto } from './dto/message.dto';
import { WsValidationPipe } from 'src/common/pipes/ws-validation.pipe';
import { Room } from './entities/room.entity';
import { CreateRoomDto, JoinRoomDto } from './dto/chat.dto';

@UseFilters(WsExceptionFilter)
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
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly messageService: MessageService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);
      await this.initializeUserConnection(user, client);
      client.join(`user-${user.sub}`);

      // Broadcast user's online status to all connected clients
      this.server.emit('userStatusChange', {
        userId: user.sub,
        isOnline: true,
      });
    } catch (error) {
      this.handleConnectionError(client, error);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const user = client.data.user;
    if (user) {
      client.leave(`user-${user.sub}`);

      // Broadcast user's offline status to all connected clients
      this.server.emit('userStatusChange', {
        userId: user.sub,
        isOnline: false,
        username: user.username,
        timestamp: new Date(),
      });
    }
  }

  @SubscribeMessage('createRoom')
  async onCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateRoomDto,
  ) {
    const room = await this.chatService.createRoom(dto, client.data.user.sub);

    return room;
  }

  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
    
  ) {
    const room = await this.chatService.findOneById(dto, client.data.user.sub);
    client.join(`room_${room.id}`);

    await this.messageService.markedMessages(room.id,client.data.user.sub);

    const messages = await this.messageService.getRecentMessages(room.id);

  
    this.server.to(`room_${room.id}`).emit('messages', messages);
    return room;
  }
  @SubscribeMessage('leaveRoom')
  onLeavRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() { roomId }: { roomId: string },
  ) {
    client.leave(`room_${roomId}`);
    this.logger.log(
      `user with ID ${client.data.user.sub} from room ID ${roomId}`,
    );
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
 
    const message = await this.messageService.createMessage(
      sendMessageDto,
      client.data.user.sub,
    );

    this.server.to(`room_${sendMessageDto.roomId}`).emit('newMessage',message);
  }

  @SubscribeMessage('getAllUsers')
  async onGetAllUsers(@ConnectedSocket() client: Socket) {
    try {
      const users = await this.userService.findAll();

      const usersWithStatus = await Promise.all(
        users.map(async (user) => ({
          ...user,
          isOnline: await this.chatService.isUserOnline(user.id),
        })),
      );

      return usersWithStatus;
    } catch (error) {
      this.logger.error(`Failed to get all users: ${error.message}`);
      throw new WsException('Failed to get users');
    }
  }

  private async initializeUserConnection(
    userPayload: JwtPayload,
    socket: Socket,
  ): Promise<void> {
    socket.data.user = userPayload;

    await this.chatService.setUserOnline(userPayload.sub, true);

    const rooms = await this.chatService.getUserChats(userPayload.sub);
    this.server.to(socket.id).emit('userAllChats', rooms);
    this.logger.log(
      `Client connected: ${socket.id} - User ID: ${userPayload.sub}`,
    );
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
    // this.onlineUsers.set(socket.data.user?.sub,false)
    this.logger.error(
      `Connection error for socket ${socket.id}: ${error.message}`,
    );
    socket.emit('exception', 'Authentication error');
    socket.disconnect();
  }
}
