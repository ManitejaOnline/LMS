import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { CoursesService } from './courses.service';
import { CreateAssignmentRuleDto } from './dto/create-assignment-rule.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { ReorderDto } from './dto/reorder.dto';
import { UpdateAssignmentRuleDto } from './dto/update-assignment-rule.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateCourseStatusDto } from './dto/update-course-status.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@ApiTags('Courses')
@ApiBearerAuth('access-token')
@Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Course admin dashboard counters' })
  dashboardStats() {
    return this.coursesService.dashboardStats();
  }

  @Get()
  @ApiOperation({ summary: 'List courses' })
  list(@Query() query: ListCoursesQueryDto) {
    return this.coursesService.listCourses(query);
  }

  @Get(':courseId/lessons')
  @ApiOperation({ summary: 'List ordered lessons for a course' })
  listLessons(@Param('courseId') courseId: string) {
    return this.coursesService.listCourseLessons(courseId);
  }

  @Post(':courseId/lessons')
  @ApiOperation({ summary: 'Create a lesson on a course (uses primary content module)' })
  createCourseLesson(
    @Param('courseId') courseId: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.createCourseLesson(
      courseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Post(':courseId/lessons/reorder')
  @ApiOperation({ summary: 'Reorder all lessons in a course' })
  reorderCourseLessons(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.reorderCourseLessons(
      courseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Get('lessons/:lessonId')
  @ApiOperation({ summary: 'Get a single lesson' })
  getLesson(@Param('lessonId') lessonId: string) {
    return this.coursesService.getLesson(lessonId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course detail with modules, lessons, rules' })
  get(@Param('id') id: string) {
    return this.coursesService.getCourse(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create course (starts as DRAFT)' })
  create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.createCourse(
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update course metadata' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.updateCourse(
      id,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change course status (Draft/Published/Archived)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCourseStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.updateStatus(
      id,
      dto.status,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete course' })
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.softDeleteCourse(
      id,
      actor,
      extractClientMeta(request),
    );
  }

  @Post(':courseId/modules')
  @ApiOperation({ summary: 'Add module to course' })
  createModule(
    @Param('courseId') courseId: string,
    @Body() dto: CreateModuleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.createModule(
      courseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch('modules/:moduleId')
  @ApiOperation({ summary: 'Update module' })
  updateModule(
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.updateModule(
      moduleId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Post(':courseId/modules/reorder')
  @ApiOperation({ summary: 'Reorder modules (drag-drop persist)' })
  reorderModules(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.reorderModules(
      courseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('modules/:moduleId')
  @ApiOperation({ summary: 'Soft delete module' })
  deleteModule(
    @Param('moduleId') moduleId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.softDeleteModule(
      moduleId,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('modules/:moduleId/lessons')
  @ApiOperation({ summary: 'Add lesson to module' })
  createLesson(
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.createLesson(
      moduleId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch('lessons/:lessonId')
  @ApiOperation({ summary: 'Update lesson' })
  updateLesson(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.updateLesson(
      lessonId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('modules/:moduleId/lessons/reorder')
  @ApiOperation({ summary: 'Reorder lessons (drag-drop persist)' })
  reorderLessons(
    @Param('moduleId') moduleId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.reorderLessons(
      moduleId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('lessons/:lessonId')
  @ApiOperation({ summary: 'Soft delete lesson' })
  deleteLesson(
    @Param('lessonId') lessonId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.softDeleteLesson(
      lessonId,
      actor,
      extractClientMeta(request),
    );
  }

  @Post(':courseId/assignment-rules')
  @ApiOperation({ summary: 'Create assignment rule for course' })
  createRule(
    @Param('courseId') courseId: string,
    @Body() dto: CreateAssignmentRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.createAssignmentRule(
      courseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch('assignment-rules/:ruleId')
  @ApiOperation({ summary: 'Update assignment rule' })
  updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateAssignmentRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.updateAssignmentRule(
      ruleId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('assignment-rules/:ruleId')
  @ApiOperation({ summary: 'Soft delete assignment rule' })
  deleteRule(
    @Param('ruleId') ruleId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.coursesService.softDeleteAssignmentRule(
      ruleId,
      actor,
      extractClientMeta(request),
    );
  }
}
