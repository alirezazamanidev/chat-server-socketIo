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
import { SendMessageDto } from '../dto/message.dto';
import { RoomTypeEnum } from '../enums/type.enum';
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
    private chatService: ChatService,
    private messageService: MessageService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const payload = this.authenticateSocket(client);
      client.data.user = payload;
      await this.chatService.setOneline(payload.id);
      client.join(`user_${payload.id}`);
      client.emit('online-status-user', { userId: payload.id, isOnline: true });
      this.logger.log(
        `Client Connected userId : ${payload.id} socketId:${client.id}`,
      );
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.disconnect();
    }
  }
  async handleDisconnect(client: Socket) {
    await this.chatService.setOffline(client.data.user?.id);
    client.leave(`user_${client.data.user.id}`);
    this.server.emit('online-status-user', {
      userId: client.data.user.id,
      isOnline: false,
      lastSeen:new Date()
    });

    this.logger.log(`User ${client.data.user.id} disconnected and cleaned up`);
  }

  @SubscribeMessage('get-user-list')
  async getUsers(@ConnectedSocket() client: Socket) {
    const users = await this.userService.findAll();

    return await Promise.all(
      users.map(async (u) => ({
        ...u,
        isOnline: await this.chatService.isOnline(u.id),
      })),
    );
  }
  @SubscribeMessage('joinRoom')
  async onJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    const userId = client.data.user.id;
    switch (data.type) {
      case RoomTypeEnum.GROUP:
        if (!data.roomId)
          throw new WsException('Room ID is required for group chat!');
        return await this.joinGroup(userId, data?.roomId, client);
      case RoomTypeEnum.PV:
        if (!data.reciverId)
          throw new WsException('Other user ID is required for private chat');
        return await this.joinRoomPv(userId, data.reciverId, client);
      default:
        throw new WsException('Type is incorect!');
    }
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() sendMessageDto: SendMessageDto,
  ) {
    const senderId = client.data.user.id;
    const { reciverId, text, type, roomId } = sendMessageDto;
    let RoomId = roomId;
    if (type === RoomTypeEnum.PV && !RoomId && reciverId) {
      let room = await this.chatService.findOnePvRoom(senderId, reciverId);
      if (!room) {
        room = await this.chatService.createPvRoom(senderId, reciverId);
      }
      client.join(`room_${room.id}`)
      RoomId = room.id;
    }
    if (type === RoomTypeEnum.GROUP && !reciverId && roomId) {
      RoomId = roomId;
    }

    const message = await this.messageService.create({
      text,
      roomId: RoomId || '',
      senderId,
    });
    this.server.to(`room_${roomId}`).emit('newMessage',message);

    // notifcation
    // if()
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

  private async joinRoomPv(userId: string, reciverId: string, socket: Socket) {
    const room = await this.chatService.findOnePvRoom(userId, reciverId);
    
    if (room) {
      const messages = await this.messageService.getRecnetMessages(room.id);

      socket.join(`room_${room.id}`);
      socket.emit('joinedRoom', {
        room,
        messages,
      });
    } else {
      const reciver = await this.userService.findById(reciverId);
      const isOnline = await this.chatService.isOnline(reciverId);
      socket.emit('pvRoomInfo', {
        room: null,
        messages: [],
        reciver: {
          ...reciver,
          isOnline,
        },
      });
    }
  }
  private async joinGroup(userId: string, roomId: string, socket: Socket) {
    const room = await this.chatService.findOneByIdGroup(roomId);
    const inGroup = room.participants.some((p) => p.id === userId);
    if (!inGroup) throw new WsException('Access denid!');
    socket.join(`room_${room.id}`);
    // recent messages
    const messages = await this.messageService.getRecnetMessages(room.id);
    this.server.to(`room_${room.id}`).emit('joinedRoom', {
      room,
      messages,
    });
  }
}
