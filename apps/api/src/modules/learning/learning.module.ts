import { Module } from '@nestjs/common';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { PageProgressService } from './page-progress.service';

@Module({
  controllers: [LearningController],
  providers: [LearningService, PageProgressService],
  exports: [LearningService, PageProgressService],
})
export class LearningModule {}
