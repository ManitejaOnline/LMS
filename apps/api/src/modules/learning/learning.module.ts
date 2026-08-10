import { Module } from '@nestjs/common';
import { ProgramsModule } from '../programs/programs.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { PageProgressService } from './page-progress.service';
import { SequentialAccessService } from './sequential-access.service';

@Module({
  imports: [ProgramsModule],
  controllers: [LearningController],
  providers: [LearningService, PageProgressService, SequentialAccessService],
  exports: [LearningService, PageProgressService, SequentialAccessService],
})
export class LearningModule {}
