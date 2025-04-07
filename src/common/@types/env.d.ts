

declare namespace NodeJS {
  interface ProcessEnv {
    // Application Settings
    PORT: string;
    NODE_ENV: 'development' | 'production' | 'test';

    // MySQL Database Configuration
    MYSQL_HOST: string;
    MYSQL_PORT: number;
    MYSQL_USERNAME: string;
    MYSQL_PASSWORD: string;
    MYSQL_DB: string;
    MYSQL_ROOT_PASSWORD: string;

    // JWT Configuration
    JWT_SECRET: string;
    JWT_EXPIRATION: string;

    // Logging
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  }
}