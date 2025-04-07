import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@Injectable()
export class WsLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(WsLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient<Socket>();
    const eventName = context.getArgByIndex(2)?.eventName;
    const data = context.getArgByIndex(1);
    
    this.logger.debug(`[WS] Received: ${eventName} from ${client.id}`);
    
    if (data) {
      this.logger.debug(`[WS] Payload: ${JSON.stringify(data)}`);
    }
    
    return next.handle().pipe(
      tap(response => {
        this.logger.debug(`[WS] Response: ${JSON.stringify(response)}`);
      })
    );
  }
} 