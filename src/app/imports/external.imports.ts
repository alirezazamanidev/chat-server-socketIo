import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmDbConfig } from "src/configs/typeorm.config";


export const appExternalImports=[
    ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env'
    }),
    TypeOrmModule.forRootAsync({
        useClass: TypeOrmDbConfig,
        
    })
]