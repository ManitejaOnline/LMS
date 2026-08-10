import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { ProgramsModule } from '../programs/programs.module';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';

@Module({
  imports: [LearningModule, ProgramsModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
