

declare namespace NodeJS {
  interface ProcessEnv {
    // Application Settings
    PORT: string;
    NODE_ENV: 'development' | 'production' | 'test';

    // PostgreSQL Database Configuration
    POSTGRES_HOST: string;
    POSTGRES_PORT: number;
    POSTGRES_USER: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_DB: string;

    // JWT Configuration
    JWT_SECRET: string;
    JWT_EXPIRATION: string;

    // Logging
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  }
}