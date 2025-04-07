export class WsException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly error?: string
  ) {
    super(message);
    this.name = 'WsException';
    Object.setPrototypeOf(this, WsException.prototype);
  }

  getResponse(): Record<string, any> {
    return {
      status: this.statusCode,
      message: this.message,
      error: this.error || this.constructor.name.replace('WsException', ''),
      timestamp: new Date().toISOString()
    };
  }
} 