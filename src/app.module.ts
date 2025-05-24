import { Module } from '@nestjs/common';
import { appIntervalImports } from './app/imports/interval.import';
import { appExternalImports } from './app/imports/external.imports';

@Module({
  imports: [
    ...appIntervalImports,
    ...appExternalImports,
    
  ]
})
export class AppModule {}
