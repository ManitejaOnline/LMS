import { Module } from '@nestjs/common';
import { AuthInfrastructureModule } from '../../infrastructure/auth/auth-infrastructure.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [StorageModule, AuthInfrastructureModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
