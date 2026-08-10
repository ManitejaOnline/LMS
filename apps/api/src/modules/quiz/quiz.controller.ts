import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { ReorderDto } from '../courses/dto/reorder.dto';
import {
  CreateAssessmentDto,
  QuizQuestionInputDto,
  SubmitQuizDto,
  UpdateAssessmentDto,
  UpsertQuizDto,
} from './dto/quiz.dto';
import { QuizService } from './quiz.service';

@ApiTags('Assessments')
@ApiBearerAuth('access-token')
@Controller()
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('lessons/:lessonId/assessment')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Create a lesson assessment (draft)' })
  create(
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.createForLesson(
      lessonId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Get('lessons/:lessonId/assessment')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Get lesson assessment (admin, includes answers)' })
  getAdmin(@Param('lessonId') lessonId: string) {
    return this.quizService.getAdminQuiz(lessonId);
  }

  @Put('lessons/:lessonId/assessment')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Replace lesson assessment question bank' })
  upsert(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.upsertForLesson(
      lessonId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Put('lessons/:lessonId/quiz')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Alias: replace lesson assessment' })
  upsertLegacy(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.upsertForLesson(
      lessonId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Get('lessons/:lessonId/quiz')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Alias: get lesson assessment (admin)' })
  getAdminLegacy(@Param('lessonId') lessonId: string) {
    return this.quizService.getAdminQuiz(lessonId);
  }

  @Get('assessments/:assessmentId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Get assessment by id (admin)' })
  getById(@Param('assessmentId') assessmentId: string) {
    return this.quizService.getById(assessmentId);
  }

  @Patch('assessments/:assessmentId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Update assessment settings' })
  update(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.updateAssessment(
      assessmentId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('assessments/:assessmentId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Soft-delete assessment' })
  remove(
    @Param('assessmentId') assessmentId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.deleteAssessment(
      assessmentId,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('assessments/:assessmentId/questions')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Add assessment question' })
  createQuestion(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: QuizQuestionInputDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.createQuestion(
      assessmentId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch('assessments/:assessmentId/questions/:questionId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Update assessment question' })
  updateQuestion(
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
    @Body() dto: QuizQuestionInputDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.updateQuestion(
      assessmentId,
      questionId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('assessments/:assessmentId/questions/:questionId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Delete assessment question' })
  deleteQuestion(
    @Param('assessmentId') assessmentId: string,
    @Param('questionId') questionId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.deleteQuestion(
      assessmentId,
      questionId,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('assessments/:assessmentId/questions/reorder')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Reorder assessment questions' })
  reorder(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.reorderQuestions(
      assessmentId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('levels/:levelId/assessment')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Create a final-level assessment (draft)' })
  createForLevel(
    @Param('levelId') levelId: string,
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.createForLevel(
      levelId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Get('levels/:levelId/assessment')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Get final-level assessment (admin)' })
  getAdminByLevel(@Param('levelId') levelId: string) {
    return this.quizService.getAdminQuizByLevel(levelId);
  }

  @Put('levels/:levelId/assessment')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Replace final-level assessment question bank' })
  upsertForLevel(
    @Param('levelId') levelId: string,
    @Body() dto: UpsertQuizDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.quizService.upsertForLevel(
      levelId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Get('learner/programs/:programId/final-assessment')
  @ApiOperation({ summary: 'Learner: final program assessment summary' })
  learnerFinal(
    @Param('programId') programId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getLearnerFinalAssessment(programId, user);
  }

  @Post('learner/programs/:programId/final-assessment/start')
  @ApiOperation({ summary: 'Learner: start final program assessment' })
  learnerFinalStart(
    @Param('programId') programId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.startFinalAttempt(programId, user);
  }

  @Get('learner/programs/:programId/final-assessment/attempts')
  @ApiOperation({ summary: 'Learner: final assessment attempt history' })
  learnerFinalAttempts(
    @Param('programId') programId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.listLearnerFinalAttempts(programId, user);
  }

  @Get('learner/lessons/:lessonId/assessment')
  @ApiOperation({ summary: 'Learner: available assessment (no correct answers)' })
  learnerAssessment(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getLearnerAssessment(lessonId, user);
  }

  @Post('learner/lessons/:lessonId/assessment/start')
  @ApiOperation({ summary: 'Learner: start or resume assessment attempt' })
  learnerStart(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.startLearnerAttempt(lessonId, user);
  }

  @Get('learner/lessons/:lessonId/assessment/attempts')
  @ApiOperation({ summary: 'Learner: assessment attempt history' })
  learnerHistory(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.listLearnerAttempts(lessonId, user);
  }

  @Post('learner/assessment-attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Learner: submit assessment; server scores' })
  learnerSubmit(
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.submitAttempt(attemptId, dto, user);
  }

  @Get('learner/assessment-attempts/:attemptId/result')
  @ApiOperation({ summary: 'Learner: submitted attempt result' })
  learnerResult(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.getAttemptResult(attemptId, user);
  }

  @Post('learning/assignments/:assignmentId/lessons/:lessonId/quiz/start')
  @ApiOperation({ summary: 'Alias: start assessment attempt' })
  start(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.startAttempt(lessonId, assignmentId, user);
  }

  @Post('learning/quiz-attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Alias: submit assessment attempt' })
  submit(
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitQuizDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.submitAttempt(attemptId, dto, user);
  }

  @Get('learning/assignments/:assignmentId/lessons/:lessonId/quiz/attempts')
  @ApiOperation({ summary: 'Alias: list assessment attempts' })
  attempts(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quizService.listAttempts(assignmentId, lessonId, user.userId);
  }
}
