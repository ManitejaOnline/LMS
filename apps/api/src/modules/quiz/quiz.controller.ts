import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { SubmitQuizDto, UpsertQuizDto } from './dto/quiz.dto';
import { QuizService } from './quiz.service';

@ApiTags('Quiz')
@ApiBearerAuth('access-token')
@Controller()
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Put('lessons/:lessonId/quiz')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Create or replace quiz question bank for a quiz lesson' })
  upsert(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.quizService.upsertForLesson(lessonId, dto, actor);
  }

  @Get('lessons/:lessonId/quiz')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Get quiz bank (admin, includes correct answers)' })
  getAdmin(@Param('lessonId') lessonId: string) {
    return this.quizService.getAdminQuiz(lessonId);
  }

  @Post('learning/assignments/:assignmentId/lessons/:lessonId/quiz/start')
  @ApiOperation({ summary: 'Start a randomized quiz attempt' })
  start(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.startAttempt(lessonId, assignmentId, user);
  }

  @Post('learning/quiz-attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Submit quiz answers and score the attempt' })
  submit(
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.submitAttempt(attemptId, dto, user);
  }

  @Get('learning/assignments/:assignmentId/lessons/:lessonId/quiz/attempts')
  @ApiOperation({ summary: 'List quiz attempts for assignment lesson' })
  attempts(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.listAttempts(assignmentId, lessonId, user.userId);
  }
}
