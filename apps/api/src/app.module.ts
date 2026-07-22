import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { AppConfigModule } from './config/config.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AuthInfrastructureModule } from './infrastructure/auth/auth-infrastructure.module';
import { JwtAuthGuard } from './infrastructure/auth/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/auth/guards/roles.guard';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { SecurityModule } from './infrastructure/security/security.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { MediaModule } from './modules/media/media.module';
import { CoursesModule } from './modules/courses/courses.module';
import { LearningModule } from './modules/learning/learning.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { ReportsModule } from './modules/reports/reports.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { NotificationModule } from './infrastructure/notifications/notification.module';
import { REQUEST_ID_HEADER } from './common/constants/metadata.keys';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const pretty = configService.get<boolean>('logging.pretty');
        const level = configService.get<string>('logging.level') ?? 'info';

        return {
          pinoHttp: {
            level,
            genReqId: (req, res) => {
              const existing = req.headers[REQUEST_ID_HEADER];
              const requestId =
                (typeof existing === 'string' && existing) || randomUUID();
              res.setHeader(REQUEST_ID_HEADER, requestId);
              return requestId;
            },
            transport: pretty
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:standard',
                  },
                }
              : undefined,
            autoLogging: true,
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
              ],
              remove: true,
            },
          },
        };
      },
    }),
    PrismaModule,
    SecurityModule,
    AuditModule,
    StorageModule,
    NotificationModule,
    AuthInfrastructureModule,
    HealthModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    MediaModule,
    CoursesModule,
    LearningModule,
    QuizModule,
    ReportsModule,
    NotificationsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
