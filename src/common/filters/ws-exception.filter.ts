import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException as NestWsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { WsException } from '../exceptions';

@Catch(WsException, NestWsException)
export class WsExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: WsException | NestWsException | Error, host: ArgumentsHost) {
    const client = host.switchToWs().getClient() as Socket;
    
    // Handle our custom WsException
    if (exception instanceof WsException) {
      const response = exception.getResponse();
      client.emit('exception', response);
      return;
    }
    
    // Handle NestJS built-in WsException
    if (exception instanceof NestWsException) {
      const error = exception.getError();
      const response = {
        status: 400,
        message: typeof error === 'string' ? error : JSON.stringify(error),
        error: 'BadRequest',
        timestamp: new Date().toISOString()
      };
      client.emit('exception', response);
      return;
    }
    
    // Handle other errors
    const response = {
      status: 500,
      message: (exception as Error).message || 'Internal server error',
      error: 'InternalServerError',
      timestamp: new Date().toISOString()
    };
    client.emit('exception', response);
  }
} 