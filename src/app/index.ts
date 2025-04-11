import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import * as express from 'express';
import { join } from 'path';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';

export const appInit = (app: NestExpressApplication) => {
  
    // Security middleware
    app.use(helmet());
    
    // Compression middleware
    app.use(compression());
    
    // Cookie parser middleware
    app.use(cookieParser());
    
    // Body parsers
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Static files serving
    app.useStaticAssets(join(process.cwd(), 'public'), {
        prefix: '/static',
      });
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