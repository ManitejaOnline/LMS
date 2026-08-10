import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { extractClientMeta } from '../../common/utils/request-meta.util';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { ReorderDto } from '../courses/dto/reorder.dto';
import {
  AddLevelCoursesDto,
  AssignProgramDto,
  CreateLevelDto,
  CreateProgramDto,
  UpdateLevelCourseDto,
  UpdateLevelDto,
  UpdateProgramDto,
  UpdateProgramStatusDto,
} from './dto/program.dto';
import { ProgramsService } from './programs.service';

@ApiTags('Programs')
@ApiBearerAuth('access-token')
@Controller()
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get('programs')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'List learning programs' })
  list() {
    return this.programs.list();
  }

  @Post('programs')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  create(
    @Body() dto: CreateProgramDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.create(dto, actor, extractClientMeta(request));
  }

  @Get('programs/:programId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  get(@Param('programId') programId: string) {
    return this.programs.get(programId);
  }

  @Patch('programs/:programId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  update(
    @Param('programId') programId: string,
    @Body() dto: UpdateProgramDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.update(programId, dto, actor, extractClientMeta(request));
  }

  @Patch('programs/:programId/status')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  updateStatus(
    @Param('programId') programId: string,
    @Body() dto: UpdateProgramStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.updateStatus(
      programId,
      dto.status,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('programs/:programId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  remove(
    @Param('programId') programId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.softDelete(programId, actor, extractClientMeta(request));
  }

  @Post('programs/:programId/levels')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  createLevel(
    @Param('programId') programId: string,
    @Body() dto: CreateLevelDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.createLevel(programId, dto, actor, extractClientMeta(request));
  }

  @Post('programs/:programId/levels/reorder')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  reorderLevels(
    @Param('programId') programId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.reorderLevels(programId, dto, actor, extractClientMeta(request));
  }

  @Patch('levels/:levelId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  updateLevel(
    @Param('levelId') levelId: string,
    @Body() dto: UpdateLevelDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.updateLevel(levelId, dto, actor, extractClientMeta(request));
  }

  @Delete('levels/:levelId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  deleteLevel(
    @Param('levelId') levelId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.deleteLevel(levelId, actor, extractClientMeta(request));
  }

  @Post('levels/:levelId/courses')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  addCourses(
    @Param('levelId') levelId: string,
    @Body() dto: AddLevelCoursesDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.addCourses(levelId, dto, actor, extractClientMeta(request));
  }

  @Post('levels/:levelId/courses/reorder')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  reorderCourses(
    @Param('levelId') levelId: string,
    @Body() dto: ReorderDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.reorderLevelCourses(
      levelId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Patch('level-courses/:levelCourseId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  updateLevelCourse(
    @Param('levelCourseId') levelCourseId: string,
    @Body() dto: UpdateLevelCourseDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.updateLevelCourse(
      levelCourseId,
      dto,
      actor,
      extractClientMeta(request),
    );
  }

  @Delete('level-courses/:levelCourseId')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  removeLevelCourse(
    @Param('levelCourseId') levelCourseId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.removeLevelCourse(
      levelCourseId,
      actor,
      extractClientMeta(request),
    );
  }

  @Post('programs/:programId/assignments')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  assign(
    @Param('programId') programId: string,
    @Body() dto: AssignProgramDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.programs.assign(programId, dto, actor, extractClientMeta(request));
  }

  @Get('learner/programs')
  @ApiOperation({ summary: 'Employee enrolled learning programs' })
  myPrograms(@CurrentUser() user: AuthenticatedUser) {
    return this.programs.myPrograms(user.userId);
  }

  @Get('learner/programs/:programId')
  myProgram(
    @Param('programId') programId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.programs.myProgram(programId, user.userId);
  }

  @Get('learner/programs/:programId/levels/:levelId')
  @ApiOperation({ summary: 'Employee: one program level and its courses only' })
  myLevel(
    @Param('programId') programId: string,
    @Param('levelId') levelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.programs.myLevel(programId, levelId, user.userId);
  }

  @Get('learner/programs/:programId/certificate')
  certificate(
    @Param('programId') programId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.programs.myCertificate(programId, user.userId);
  }

  @Get('learner/programs/:programId/certificate.html')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async certificateHtml(
    @Param('programId') programId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const cert = await this.programs.myCertificate(programId, user.userId);
    const html = this.programs.certificateHtml(cert);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${cert.certificateCode}.html"`,
    );
    res.send(html);
  }
}
