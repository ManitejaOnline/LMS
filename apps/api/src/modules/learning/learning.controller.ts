import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { AssignCourseDto } from './dto/assign-course.dto';
import { IngestLearningEventsDto } from './dto/ingest-learning-events.dto';
import { CompletePageDto, SavePageProgressDto } from './dto/page-progress.dto';
import { LearnerLessonProgressDto } from './dto/learner-lesson-progress.dto';
import { LearningService } from './learning.service';
import { PageProgressService } from './page-progress.service';

@ApiTags('Learning')
@ApiBearerAuth('access-token')
@Controller()
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly pageProgress: PageProgressService,
  ) {}

  @Get('learner/courses/:courseId/lessons')
  @ApiOperation({ summary: 'Enrolled learner: ordered course lessons + lock state' })
  learnerCourseLessons(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.listLearnerCourseLessons(courseId, user);
  }

  @Get('learner/lessons/:lessonId/progress')
  @ApiOperation({ summary: 'Enrolled learner: lesson progress' })
  learnerLessonProgress(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.getLearnerLessonProgress(lessonId, user);
  }

  @Post('learner/lessons/:lessonId/progress')
  @ApiOperation({ summary: 'Enrolled learner: persist video/resume progress' })
  saveLearnerLessonProgress(
    @Param('lessonId') lessonId: string,
    @Body() dto: LearnerLessonProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.saveLearnerLessonProgress(lessonId, dto, user);
  }

  @Post('learner/lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Enrolled learner: complete current accessible lesson' })
  completeLearnerLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.completeLearnerLesson(lessonId, user);
  }

  @Get('learning/dashboard')
  @ApiOperation({ summary: 'Employee learning dashboard counters' })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.learningService.employeeDashboard(user.userId);
  }

  @Get('learning/assignments')
  @ApiOperation({ summary: 'List my assigned courses' })
  myAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.learningService.myAssignments(user.userId);
  }

  @Get('learning/assignments/:assignmentId/player')
  @ApiOperation({ summary: 'Course player payload for an assignment' })
  player(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.getPlayer(assignmentId, user);
  }

  @Post('learning/assignments/:assignmentId/events')
  @ApiOperation({ summary: 'Ingest learning tracker events (batch)' })
  ingest(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: IngestLearningEventsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.ingestEvents(assignmentId, dto, user);
  }

  @Get('learning/assignments/:assignmentId/timeline')
  @ApiOperation({ summary: 'Learning timeline / audit trail for assignment' })
  timeline(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.timeline(assignmentId, user);
  }

  @Post('learning/assignments/:assignmentId/lessons/:lessonId/complete')
  @ApiOperation({ summary: 'Mark lesson completed' })
  completeLesson(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.markLessonComplete(
      assignmentId,
      lessonId,
      user,
    );
  }

  @Get('learning/assignments/:assignmentId/lessons/:lessonId/page-progress')
  @ApiOperation({ summary: 'Get PDF page reading progress for a lesson' })
  getPageProgress(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pageProgress.listPageProgress(assignmentId, lessonId, user);
  }

  @Get('learning/assignments/:assignmentId/lessons/:lessonId/resume')
  @ApiOperation({
    summary: 'Resume PDF lesson (last page + remaining reading time)',
  })
  resumeLesson(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.learningService.resumePdfLesson(assignmentId, lessonId, user);
  }

  @Post('learning/assignments/:assignmentId/lessons/:lessonId/page-progress')
  @ApiOperation({
    summary: 'Autosave / heartbeat PDF page reading progress (anti-spoof capped)',
  })
  savePageProgress(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: SavePageProgressDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pageProgress.saveHeartbeat(assignmentId, lessonId, dto, user);
  }

  @Post(
    'learning/assignments/:assignmentId/lessons/:lessonId/pages/:pageNumber/complete',
  )
  @ApiOperation({
    summary: 'Complete a PDF page (server validates required reading time)',
  })
  completePage(
    @Param('assignmentId') assignmentId: string,
    @Param('lessonId') lessonId: string,
    @Param('pageNumber') pageNumber: string,
    @Body() dto: CompletePageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pageProgress.completePage(
      assignmentId,
      lessonId,
      {
        ...dto,
        pageNumber: Number(pageNumber) || dto.pageNumber || 0,
      },
      user,
    );
  }

  @Post('courses/:courseId/assignments/apply-rules')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Materialize assignment rules into learner assignments' })
  applyRules(
    @Param('courseId') courseId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.learningService.applyRules(
      courseId,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('courses/:courseId/assignments')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({
    summary: 'Assign a published course via the assignment wizard',
  })
  assign(
    @Param('courseId') courseId: string,
    @Body() dto: AssignCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.learningService.assignCourse(
      courseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Get('courses/:courseId/assignments/stats')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Assignment completion summary for a course' })
  assignmentStats(@Param('courseId') courseId: string) {
    return this.learningService.assignmentStats(courseId);
  }
}
