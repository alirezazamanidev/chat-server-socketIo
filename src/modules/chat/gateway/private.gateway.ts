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
import { JoinRoomDto } from '../dto/chat.dto';
import { PvChatService } from '../services/pvChat.service';
import { MessageService } from '../services/message.service';
import { SendMessageDto } from '../dto/message.dto';
import { UserService } from 'src/modules/user/user.service';
@WebSocketGateway({
  namespace: 'private',
  cors: {
    origin: '*',
  },
})
export class PvChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(PvChatGateway.name);
  @WebSocketServer()
  private server: Server;
  constructor(
    private userService:UserService,
    private jwtService: JwtService,
    private pvChatService: PvChatService,
    private messageService: MessageService,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}
  async handleConnection(client: Socket) {
    try {
      const user = this.authenticateSocket(client);
      client.data.user = user;
      await this.redisClient.set(`user:online:${user.id}`, client.id);
      this.logger.log(
        `client Connected userId: ${user.id} socketId:${client.id}`,
      );
      this.server.emit('userOnline', {
        userId: user.id,
        isOnline: true,
        
      });
    } catch (error) {
      this.logger.error(`Client can not connected Error :`, error.message);
      client.disconnect();
    }
  }
  async handleDisconnect(client: Socket) {
    try {
      const user = client.data.user;

      await this.redisClient.del(`user:online:${user.id}`);
      this.logger.log(
        `client disConnected, userId :${user.id} socketId: ${client.id}`,
      );
      this.server.emit('userOnline', {
        userId: user.id,
        isOnline: false,
        lastSeen: new Date(),
      });
    } catch (error) {
      this.logger.log('client can not disconnected !!');
    }
  }

  @SubscribeMessage('getAllUsers')
  async onGetAllUsers() {
    // گرفتن همه کاربران از دیتابیس
    const users = await this.userService.findAll();
  
    if (!users.length) {
      return [];
    }
  
    // ساخت لیست کلیدهای Redis برای بررسی وضعیت آنلاین
    const keys = users.map(user => `user:online:${user.id}`);
  
    // گرفتن وضعیت آنلاین همه کاربران به صورت یکجا با mget
    const onlineStatuses = await this.redisClient.mget(keys);
    // ترکیب اطلاعات کاربران با وضعیت آنلاین
    return users.map((user, index) => ({
    ...user,
      isOnline: onlineStatuses[index] ? true : false,
    }));
  }
  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    const user = client.data.user;

    const room = await this.pvChatService.getOrCreateRoom(dto, user.id);

    client.join(`room_${room.id}`);
    this.logger.log(`client joined to room userId : ${user.id} socketId :${client.id}`)
    const mesesages = await this.messageService.getRecnetMessages(room.id);
    
    this.server.to(`room_${room.id}`).emit('messages', mesesages);
    return room
  }
  @SubscribeMessage('leaveRoom')
  async onLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: {roomId:string},
  ) {
    const user = client.data.user;
    client.leave(`room_${dto.roomId}`);
    this.logger.log(`client left from room userId : ${user.id} socketId :${client.id}`)
  }
  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = client.data.user;
    const newMessage = await this.messageService.create(dto, user.id);

    this.server.to(`room_${dto.roomId}`).emit('newMessage', newMessage);


  }

  private authenticateSocket(socket: Socket): JwtPayload {
    const token = this.extractJwtToken(socket);
    return this.jwtService.verify<JwtPayload>(token, {
      secret: process.env.ACCESS_TOKEN_SECRET,
    });
  }
  private extractJwtToken(socket: Socket): string {
    const authHeader = socket.handshake.headers.authorization;
    if (!authHeader)
      throw new UnauthorizedException('No authorization header found');

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token)
      throw new UnauthorizedException('Invalid or missing token');

    return token;
  }
}
