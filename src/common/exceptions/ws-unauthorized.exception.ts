import { WsException } from './ws-exception.base';

export class WsUnauthorizedException extends WsException {
  constructor(message = 'Unauthorized access', error = 'Unauthorized') {
    super(message, 401, error);
  }
} 