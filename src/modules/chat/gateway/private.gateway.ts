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
    private jwtService: JwtService,
    private pvChatService:PvChatService,
    private messageService:MessageService,
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
    } catch (error) {
      this.logger.log('client can not disconnected !!');
    }
  }
  @SubscribeMessage('joinRoom')
 async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinRoomDto,
  ) {
    const user=client.data.user;
  
    const room=await this.pvChatService.getOrCreateRoom(dto,user.id);

    client.join(`room_${room.id}`);
    const mesesages=await this.messageService.getRecnetMessages(room.id);

    this.server.to(`room_${room.id}`).emit('messages',mesesages);

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
