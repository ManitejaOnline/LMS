import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join, isAbsolute } from 'path';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  const storageRoot = configService.getOrThrow<string>('storage.rootDir');
  const publicBase = configService.getOrThrow<string>('storage.publicBaseUrl');
  const prefix = publicBase.endsWith('/') ? publicBase : `${publicBase}/`;
  const assetsRoot = isAbsolute(storageRoot)
    ? storageRoot
    : join(process.cwd(), storageRoot);

  app.useStaticAssets(assetsRoot, {
    prefix,
  });

  const globalPrefix = configService.getOrThrow<string>('app.globalPrefix');
  app.setGlobalPrefix(globalPrefix);

  app.enableCors({
    origin: configService.getOrThrow<string[]>('app.corsOrigins'),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['Content-Disposition'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  const swaggerEnabled = configService.get<boolean>('swagger.enabled');
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Zebl Training Portal API')
      .setDescription(
        'Zebl Training Portal API — Auth, Users, and Course Management.',
      )
      .setVersion('0.3.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token (JWT)',
        },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    const swaggerPath = configService.getOrThrow<string>('swagger.path');
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  const port = configService.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');

  logger.log(
    `API listening on http://localhost:${port}/${globalPrefix}`,
    'Bootstrap',
  );
  if (swaggerEnabled) {
    const swaggerPath = configService.getOrThrow<string>('swagger.path');
    logger.log(
      `Swagger docs at http://localhost:${port}/${swaggerPath}`,
      'Bootstrap',
    );
  }
}

void bootstrap();
