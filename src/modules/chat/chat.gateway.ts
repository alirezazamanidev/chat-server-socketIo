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
import { RoomTypeEnum } from './enums/type.enum';
import { WsValidationPipe } from 'src/common/pipes/ws-validation.pipe';
import { CreateRoomDto } from './dto/chat.dto';
import { WsCurrentUser } from 'src/common/decorators/ws-current-user.decorator';
import { UserService } from '../user/user.service';
import { MessageService } from './services/message.service';

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
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly messageService: MessageService,
  ) {}


  async handleConnection(client: Socket) {
    try {
      const user = await this.authenticateSocket(client);
      await this.initializeUserConnection(user, client);
      client.join(`user-${user.sub}`)
    } catch (error) {
      this.handleConnectionError(client, error);
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const user=client.data.user
    client.leave(`user-${user.sub}`)
  }

  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody(new WsValidationPipe()) messageData: { chatId: string }
  ){
    const { chatId } = messageData;
   
    const chat=await this.chatService.findChatById(chatId)
    client.join(`chat-${chat.id}`);
    return chat
  }

  @SubscribeMessage('createRoom')
  async onCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody(new WsValidationPipe()) messageData: { receiverId: string }
  ){
    const { receiverId } = messageData;
    const senderId=client.data.user.sub
    const chat=await this.chatService.createChat(senderId,receiverId);
    return chat.id;
  }

  @SubscribeMessage('leaveRoom')
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody(new WsValidationPipe()) messageData: { chatId: string }
  ){
    const { chatId } = messageData;
    client.leave(`chat-${chatId}`);
    await this.chatService.removeChat(chatId);
  }
  
  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody(new WsValidationPipe()) messageData: { chatId: string, text: string }
  ){
    const { chatId, text } = messageData;
    const senderId=client.data.user.sub
    const chat=await this.chatService.findChatById(chatId)
    const message=await this.messageService.createMessage(senderId,chatId,text)
    this.server.to(`user-${chat.receiverId}`).emit('message',message);
    this.server.to(`chat-${chatId}`).emit('message',message);
    return message;
  }
  
  @SubscribeMessage('getAllUsers')
  async onGetAllUsers(
    @ConnectedSocket() client: Socket,
  ){
    const users=await this.userService.findAll()
    return users;
  }
  private async initializeUserConnection(
    userPayload: JwtPayload,
    socket: Socket,
  ): Promise<void> {
    socket.data.user = userPayload;
  
    const chats = await this.chatService.findByUserId(userPayload.sub);
    this.server.to(socket.id).emit('userAllChats', chats);
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
    this.logger.error(
      `Connection error for socket ${socket.id}: ${error.message}`,
    );
    socket.emit('exception', 'Authentication error');
    socket.disconnect();
  }
}
