import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  authConfig,
  databaseConfig,
  jwtConfig,
  loggingConfig,
  storageConfig,
  swaggerConfig,
} from './configuration';
import { validateEnv } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      validate: validateEnv,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        loggingConfig,
        swaggerConfig,
        authConfig,
        storageConfig,
      ],
    }),
  ],
  exports: [ConfigModule],
})
export class AppConfigModule {}
