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
      await this.chatService.setOneline(payload.id);
      client.join(`user_${payload.id}`);
      client.emit('online-status-user', { userId: payload.id, isOnline: true });
      const rooms = await this.chatService.findUserChats(payload.id);
      this.server.to(`user_${payload.id}`).emit('chatList', rooms);
      this.logger.log(`Client Connected userId: ${payload.id} socketId: ${client.id}`);
    } catch (error) {
      this.logger.error(`Socket connection error: ${error.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data.user?.id;
      if (userId) {
        await this.chatService.setOffline(userId);
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
      const onlineStatuses = await this.chatService.getOnlineStatuses(users.map(u => u.id));
      return users.map((u, index) => ({
        ...u,
        isOnline: onlineStatuses[index],
      }));
    } catch (error) {
      this.logger.error(`Error in getUsers: ${error.message}`);
      throw new WsException('Failed to fetch users');
    }
  }

  @SubscribeMessage('joinRoom')
  async onJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() data: JoinRoomDto) {
    try {
      const userId = client.data.user.id;
      switch (data.type) {
        case RoomTypeEnum.GROUP:
          if (!data.roomId) throw new WsException('Room ID is required for group chat');
          return await this.joinGroup(userId, data.roomId, client);
        case RoomTypeEnum.PV:
          if (!data.receiverId) throw new WsException('Receiver ID is required for private chat');
          return await this.joinRoomPv(userId, data.receiverId, client);
        default:
          throw new WsException('Invalid room type');
      }
    } catch (error) {
      this.logger.error(`Error in joinRoom: ${error.message}`);
      throw new WsException('Failed to join room');
    }
  }

  @SubscribeMessage('leaveRoom')
  onLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId?: string }) {
    try {
      if (!data.roomId) throw new WsException('Room ID is required');
      client.leave(`room_${data.roomId}`);
      this.logger.log(`Left the Room socketId: ${client.id} roomId: ${data.roomId}`);
    } catch (error) {
      this.logger.error(`Error in leaveRoom: ${error.message}`);
      throw new WsException('Failed to leave room');
    }
  }

  @SubscribeMessage('sendMessage')
  async onSendMessage(@ConnectedSocket() client: Socket, @MessageBody() sendMessageDto: SendMessageDto) {
    try {
      const senderId = client.data.user.id;
      const { receiverId, text, type, roomId } = sendMessageDto;

      let RoomId = roomId;
      let isNewRoom = false;

      if (type === RoomTypeEnum.PV) {
        if (!receiverId) throw new WsException('Receiver ID is required');
        let room = await this.chatService.findOnePvRoom(senderId, receiverId);
        if (!room) {
          room = await this.chatService.createPvRoom(senderId, receiverId);
          isNewRoom = true;
        }
        RoomId = room.id;
        client.join(`room_${RoomId}`);
      } else if (type === RoomTypeEnum.GROUP) {
        if (!roomId) throw new WsException('Room ID is required for group message');
        const room = await this.chatService.findOneByIdGroup(roomId);
        if (!room.participants.some((p) => p.id === senderId)) {
          throw new WsException('You are not a member of this group');
        }
        RoomId = roomId;
      }

      const message = await this.messageService.create({
        text,
        roomId: RoomId!,
        senderId,
      
      });

      let isRead = false;
      if (type === RoomTypeEnum.PV && receiverId) {
        const roomSockets = await this.server.in(`room_${RoomId}`).fetchSockets();
        const isReceiverInRoom = roomSockets.some((socket) => socket.data?.user?.id === receiverId)
        if (isReceiverInRoom) {
          isRead = true;
          await this.messageService.seenMessage(message.id);
        }
      }

      this.server.to(`room_${RoomId}`).emit('newMessage', { ...message, isRead });

      if (type === RoomTypeEnum.PV && receiverId) {
        this.server.to(`user_${receiverId}`).emit('notification', {
          type: 'message',
          data: { ...message, isRead },
        });
      }

      if (isNewRoom && receiverId) {
        const senderChats = await this.chatService.findUserChats(senderId);
        this.server.to(`user_${senderId}`).emit('chatList', senderChats);
        if (await this.chatService.isOnline(receiverId)) {
          const receiverChats = await this.chatService.findUserChats(receiverId);
          this.server.to(`user_${receiverId}`).emit('chatList', receiverChats);
        }
      }
    } catch (error) {
      this.logger.error(`Error in sendMessage: ${error.message}`);
      throw new WsException('Failed to send message');
    }
  }

  @SubscribeMessage('isTyping')
  onIsTypeing(
    @ConnectedSocket() client: Socket,
    @MessageBody() { type, roomId }: { type: RoomTypeEnum; roomId?: string },
  ) {
    try {
      if (type === RoomTypeEnum.GROUP || type === RoomTypeEnum.PV) {
        if (!roomId) throw new WsException('Room ID is required');
        this.server.to(`room_${roomId}`).emit('typing', {
          user: client.data.user,
          istyping: true,
        });
      }
    } catch (error) {
      this.logger.error(`Error in isTyping: ${error.message}`);
      throw new WsException('Failed to handle typing event');
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
    if (!authHeader) throw new UnauthorizedException('No authorization header found');
    const [bearer, token] = authHeader.split(' ');
    if (bearer.toLowerCase() !== 'bearer' || !token || !isJWT(token)) {
      throw new UnauthorizedException('Invalid or missing token');
    }
    return token;
  }

  private async joinRoomPv(userId: string, receiverId: string, socket: Socket) {
    try {
      let room = await this.chatService.findOnePvRoom(userId, receiverId);
      if (!room) {
        room = await this.chatService.createPvRoom(userId, receiverId);
      }

      const messages = await this.messageService.getRecnetMessages(room.id);
      socket.join(`room_${room.id}`);
      socket.emit('messages', messages);

      const receiver = await this.userService.findById(receiverId);
      const isOnline = await this.chatService.isOnline(receiverId);
      socket.emit('pvRoomInfo', {
        receiver: { ...receiver, isOnline },
      });

      return room;
    } catch (error) {
      this.logger.error(`Error in joinRoomPv: ${error.message}`);
      throw new WsException('Failed to join private room');
    }
  }

  private async joinGroup(userId: string, roomId: string, socket: Socket) {
    try {
      const room = await this.chatService.findOneByIdGroup(roomId);
      if (!room.participants.some((p) => p.id === userId)) {
        throw new WsException('Access denied');
      }
      socket.join(`room_${room.id}`);
      const messages = await this.messageService.getRecnetMessages(room.id);
      this.server.to(`room_${room.id}`).emit('joinedRoom', { room, messages });
    } catch (error) {
      this.logger.error(`Error in joinGroup: ${error.message}`);
      throw new WsException('Failed to join group room');
    }
  }
}