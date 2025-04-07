import { WsException } from './ws-exception.base';

export class WsNotFoundException extends WsException {
  constructor(message = 'Resource not found', error = 'Not Found') {
    super(message, 404, error);
  }
} 