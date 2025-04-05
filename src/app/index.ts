import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";

import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';

export const appInit = (app: NestExpressApplication) => {
  
    // Security middleware
    app.use(helmet());
    
    // Compression middleware
    app.use(compression());
    
    // Cookie parser middleware
    app.use(cookieParser());
    
    // CORS configuration
    app.enableCors({
        origin: '*',
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization']
    });
    
    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        })
    );
    
  
}