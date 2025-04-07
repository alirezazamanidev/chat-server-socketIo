import { WsException } from './ws-exception.base';

export class WsForbiddenException extends WsException {
  constructor(message = 'Access forbidden', error = 'Forbidden') {
    super(message, 403, error);
  }
} 