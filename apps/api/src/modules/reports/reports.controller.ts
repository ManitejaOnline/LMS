import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppRole } from '@zebl/shared';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { ReportsService } from './reports.service';

class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  action?: string;
}

@ApiTags('Reports')
@ApiBearerAuth('access-token')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('admin-dashboard')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Admin executive dashboard metrics' })
  adminDashboard() {
    return this.reportsService.adminDashboard();
  }

  @Get('manager-dashboard')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Manager team progress dashboard' })
  managerDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.managerDashboard(user);
  }

  @Get('course-completion')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Course completion rates' })
  courseCompletion() {
    return this.reportsService.courseCompletion();
  }

  @Get('employee-progress')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Employee progress across assignments' })
  employeeProgress() {
    return this.reportsService.employeeProgress();
  }

  @Get('reading-time')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'PDF reading time analytics' })
  readingTime() {
    return this.reportsService.readingTimeAnalytics();
  }

  @Get('video-analytics')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Video watch analytics' })
  videoAnalytics() {
    return this.reportsService.videoAnalytics();
  }

  @Get('quiz-analytics')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN, AppRole.MANAGER)
  @ApiOperation({ summary: 'Quiz performance analytics' })
  quizAnalytics() {
    return this.reportsService.quizAnalytics();
  }

  @Get('audit-logs')
  @Roles(AppRole.SUPER_ADMIN, AppRole.ADMIN)
  @ApiOperation({ summary: 'Security and compliance audit log' })
  auditLogs(@Query() query: AuditQueryDto) {
    return this.reportsService.auditLogs(query);
  }
}
