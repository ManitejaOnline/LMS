import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { LearningModule } from '../learning/learning.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [MediaModule, LearningModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
