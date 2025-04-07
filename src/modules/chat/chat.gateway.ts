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
import { ConnectedUserService } from './services/connectced-user.service';
import { User } from '../user/entities/user.entity';
import { JwtPayload } from '../auth/types/payload.type';
import { RoomTypeEnum } from './enums/type.enum';
import { WsValidationPipe } from 'src/common/pipes/ws-validation.pipe';
import { CreateRoomDto } from './dto/chat.dto';
import { WsCurrentUser } from 'src/common/decorators/ws-current-user.decorator';

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
    await this.initializeUserConnection(user,client)
   } catch (error) {
    this.handleConnectionError(client,error)
   }
  }



  async handleDisconnect(client: Socket) {
    await this.connectedUserService.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('createRoom')
  async onCreateRoom(
    @WsCurrentUser() currentUser:JwtPayload,
    @MessageBody(new WsValidationPipe()) createRoomDto: CreateRoomDto,
  ): Promise<void> {
    try {
      this.validateRoomTypeAndParticipants(
        createRoomDto.type,
        createRoomDto.participants,
        currentUser.sub
      );

      const newRoom = await this.chatService.create(
        currentUser.sub,
        createRoomDto,
      );

      const createdRoomWithDetails = await this.chatService.findOne(
        currentUser.sub,
        newRoom.id,
      );

      await this.notifyRoomParticipants(
        createdRoomWithDetails.participants,
        'roomCreated',
        createdRoomWithDetails,
      );
      this.logger.log(
        `Room with ID ${newRoom.id} created and participants notified successfully.`,
      );
    } catch (error) {
      this.logger.error(`Failed to create room: ${error.message}`, error.stack);
      throw new WsException('Error occurred while creating the room.');
    }
  }

  private async initializeUserConnection(
    userPayload: JwtPayload,
    socket: Socket,
  ): Promise<void> {
    socket.data.user = userPayload;
    await this.connectedUserService.create(userPayload.sub, socket.id);

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
  private validateRoomTypeAndParticipants(
    roomType: string,
    participants: string[],
    userId: string,
  ): void {
    if (participants.includes(userId)) {
      throw new WsException(
        'The room owner or updater should not be included in the participants list.',
      );
    }

    if (roomType === RoomTypeEnum.DIRECT && participants.length !== 1) {
      throw new WsException(
        'Direct chat must include exactly one participant aside from the room owner or updater.',
      );
    }

    if (roomType === RoomTypeEnum.GROUP && participants.length < 1) {
      throw new WsException(
        'Group chat must include at least one participant aside from the room owner or updater.',
      );
    }

    const uniqueParticipantIds = new Set(participants);
    if (uniqueParticipantIds.size !== participants.length) {
      throw new WsException('The participants list contains duplicates.');
    }
  }
  private async notifyRoomParticipants(
    participants: User[],
    event: string,
    payload: any,
  ): Promise<void> {
    const notificationPromises = participants.flatMap((participant) =>
      participant.connectedUsers.map(({ socketId }) => ({
        socketId,
        promise: this.emitToSocket(socketId, event, payload),
      })),
    );

    const results = await Promise.allSettled(
      notificationPromises.map((np) => np.promise),
    );

    results.forEach((result, index) => {
      const { socketId } = notificationPromises[index];
      if (result.status === 'fulfilled') {
        this.logger.log(
          `Notification sent successfully to Socket ID ${socketId} for event '${event}'`,
        );
      } else if (result.status === 'rejected') {
        this.logger.error(
          `Failed to notify Socket ID ${socketId} for event '${event}': ${result.reason}`,
        );
      }
    });
  }

  private async emitToSocket(
    socketId: string,
    event: string,
    payload: any,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.to(socketId).emit(event, payload, (response: any) => {
        if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  private handleConnectionError(socket: Socket, error: Error): void {
    this.logger.error(
      `Connection error for socket ${socket.id}: ${error.message}`,
    );
    socket.emit('exception', 'Authentication error');
    socket.disconnect();
  }
}
