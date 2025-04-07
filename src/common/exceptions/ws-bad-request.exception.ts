import { WsException } from './ws-exception.base';

export class WsBadRequestException extends WsException {
  constructor(message = 'Bad request', error = 'Bad Request') {
    super(message, 400, error);
  }
} 