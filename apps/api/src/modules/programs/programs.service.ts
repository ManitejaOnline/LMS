import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  AssignmentStatus,
  CourseStatus,
  LevelCompletionRule,
  Prisma,
  ProgramStatus,
  UserStatus,
} from '@prisma/client';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { NotificationService } from '../../infrastructure/notifications/notification.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AssignScope } from '../learning/dto/assign-course.dto';
import { ReorderDto } from '../courses/dto/reorder.dto';
import {
  AddLevelCoursesDto,
  AssignProgramDto,
  CreateLevelDto,
  CreateProgramDto,
  UpdateLevelCourseDto,
  UpdateLevelDto,
  UpdateProgramDto,
} from './dto/program.dto';
import { ProgramProgressService } from './program-progress.service';
import { validateProgramPublish } from './program-rules';
import { toLearnerLevelDetail, toProgramSummary } from './learner-level.view';

type ClientMeta = { ipAddress?: string; userAgent?: string };

const programInclude = {
  thumbnailMedia: true,
  levels: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      courses: {
        orderBy: { sortOrder: 'asc' as const },
        include: { course: { include: { thumbnailMedia: true } } },
      },
      finalAssessment: {
        where: { deletedAt: null },
      },
    },
  },
} satisfies Prisma.LearningProgramInclude;

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly progress: ProgramProgressService,
  ) {}

  async list() {
    const items = await this.prisma.learningProgram.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        thumbnailMedia: true,
        levels: {
          where: { deletedAt: null },
          include: { courses: true },
        },
        _count: { select: { enrollments: { where: { deletedAt: null } } } },
      },
    });
    return items.map((program) => ({
      ...program,
      levelCount: program.levels.length,
      courseCount: program.levels.reduce((sum, level) => sum + level.courses.length, 0),
      publishReadiness: this.computeReadiness(program),
    }));
  }

  async get(id: string) {
    const program = await this.prisma.learningProgram.findFirst({
      where: { id, deletedAt: null },
      include: programInclude,
    });
    if (!program) throw new NotFoundException('Program not found');
    return this.withReadiness(program);
  }

  async create(dto: CreateProgramDto, actor: AuthenticatedUser, meta?: ClientMeta) {
    const program = await this.prisma.learningProgram.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        thumbnailMediaId: dto.thumbnailMediaId ?? null,
        createdById: actor.userId,
      },
      include: programInclude,
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.PROGRAM_CREATE,
      entityType: 'LearningProgram',
      entityId: program.id,
      ...meta,
    });
    return this.withReadiness(program);
  }

  async update(id: string, dto: UpdateProgramDto, actor: AuthenticatedUser, meta?: ClientMeta) {
    await this.requireProgram(id);
    const program = await this.prisma.learningProgram.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        thumbnailMediaId: dto.thumbnailMediaId,
      },
      include: programInclude,
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.PROGRAM_UPDATE,
      entityType: 'LearningProgram',
      entityId: id,
      ...meta,
    });
    return this.withReadiness(program);
  }

  async updateStatus(
    id: string,
    status: ProgramStatus,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const program = await this.get(id);
    if (status === ProgramStatus.PUBLISHED) {
      this.assertPublishable(program);
    }
    const updated = await this.prisma.learningProgram.update({
      where: { id },
      data: {
        status,
        publishedAt: status === ProgramStatus.PUBLISHED ? new Date() : program.publishedAt,
      },
      include: programInclude,
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.PROGRAM_STATUS_CHANGE,
      entityType: 'LearningProgram',
      entityId: id,
      metadata: { status },
      ...meta,
    });
    return this.withReadiness(updated);
  }

  async softDelete(id: string, actor: AuthenticatedUser, meta?: ClientMeta) {
    await this.requireProgram(id);
    await this.prisma.learningProgram.update({
      where: { id },
      data: { deletedAt: new Date(), status: ProgramStatus.ARCHIVED },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.PROGRAM_SOFT_DELETE,
      entityType: 'LearningProgram',
      entityId: id,
      ...meta,
    });
    return { id, deleted: true };
  }

  async createLevel(
    programId: string,
    dto: CreateLevelDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireProgram(programId);
    if (dto.isFinal) await this.clearOtherFinals(programId);
    const max = await this.prisma.learningLevel.aggregate({
      where: { programId, deletedAt: null },
      _max: { sortOrder: true },
    });
    const level = await this.prisma.learningLevel.create({
      data: {
        programId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        isFinal: !!dto.isFinal,
        completionRule: LevelCompletionRule.ALL_REQUIRED,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_CREATE,
      entityType: 'LearningLevel',
      entityId: level.id,
      metadata: { programId },
      ...meta,
    });
    return this.get(programId);
  }

  async updateLevel(
    levelId: string,
    dto: UpdateLevelDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const level = await this.requireLevel(levelId);
    if (dto.isFinal) await this.clearOtherFinals(level.programId, levelId);
    await this.prisma.learningLevel.update({
      where: { id: levelId },
      data: {
        title: dto.title?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        isFinal: dto.isFinal,
      },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_UPDATE,
      entityType: 'LearningLevel',
      entityId: levelId,
      ...meta,
    });
    return this.get(level.programId);
  }

  async deleteLevel(levelId: string, actor: AuthenticatedUser, meta?: ClientMeta) {
    const level = await this.requireLevel(levelId);
    await this.prisma.learningLevel.update({
      where: { id: levelId },
      data: { deletedAt: new Date() },
    });
    await this.renumberLevels(level.programId);
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_SOFT_DELETE,
      entityType: 'LearningLevel',
      entityId: levelId,
      ...meta,
    });
    return this.get(level.programId);
  }

  async reorderLevels(
    programId: string,
    dto: ReorderDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireProgram(programId);
    const levels = await this.prisma.learningLevel.findMany({
      where: { programId, deletedAt: null },
    });
    const ids = new Set(levels.map((item) => item.id));
    if (dto.items.length !== levels.length || dto.items.some((item) => !ids.has(item.id))) {
      throw new BadRequestException('Reorder payload must include all levels.');
    }
    await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.learningLevel.update({ where: { id: item.id }, data: { sortOrder: index } }),
      ),
    );
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_REORDER,
      entityType: 'LearningProgram',
      entityId: programId,
      ...meta,
    });
    return this.get(programId);
  }

  async addCourses(
    levelId: string,
    dto: AddLevelCoursesDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const level = await this.requireLevel(levelId);
    const uniqueIds = [...new Set(dto.courseIds)];
    const courses = await this.prisma.course.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null, status: CourseStatus.PUBLISHED },
    });
    if (courses.length !== uniqueIds.length) {
      throw new BadRequestException('Only published courses can be added to a level.');
    }
    const existing = await this.prisma.levelCourse.findMany({
      where: { levelId, courseId: { in: uniqueIds } },
    });
    const existingIds = new Set(existing.map((row) => row.courseId));
    const toAdd = uniqueIds.filter((id) => !existingIds.has(id));
    if (toAdd.length === 0) {
      throw new BadRequestException('Selected courses are already in this level.');
    }
    const max = await this.prisma.levelCourse.aggregate({
      where: { levelId },
      _max: { sortOrder: true },
    });
    await this.prisma.levelCourse.createMany({
      data: toAdd.map((courseId, index) => ({
        levelId,
        courseId,
        isRequired: true,
        sortOrder: (max._max.sortOrder ?? -1) + 1 + index,
      })),
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_COURSE_ADD,
      entityType: 'LearningLevel',
      entityId: levelId,
      metadata: { courseIds: toAdd },
      ...meta,
    });
    return this.get(level.programId);
  }

  async updateLevelCourse(
    levelCourseId: string,
    dto: UpdateLevelCourseDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const row = await this.prisma.levelCourse.findUnique({
      where: { id: levelCourseId },
      include: { level: true },
    });
    if (!row || row.level.deletedAt) throw new NotFoundException('Level course not found');
    await this.prisma.levelCourse.update({
      where: { id: levelCourseId },
      data: { isRequired: dto.isRequired },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_UPDATE,
      entityType: 'LevelCourse',
      entityId: levelCourseId,
      ...meta,
    });
    return this.get(row.level.programId);
  }

  async removeLevelCourse(levelCourseId: string, actor: AuthenticatedUser, meta?: ClientMeta) {
    const row = await this.prisma.levelCourse.findUnique({
      where: { id: levelCourseId },
      include: { level: true },
    });
    if (!row) throw new NotFoundException('Level course not found');
    await this.prisma.levelCourse.delete({ where: { id: levelCourseId } });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_COURSE_REMOVE,
      entityType: 'LevelCourse',
      entityId: levelCourseId,
      ...meta,
    });
    return this.get(row.level.programId);
  }

  async reorderLevelCourses(levelId: string, dto: ReorderDto, actor: AuthenticatedUser, meta?: ClientMeta) {
    const level = await this.requireLevel(levelId);
    const rows = await this.prisma.levelCourse.findMany({ where: { levelId } });
    const ids = new Set(rows.map((row) => row.id));
    if (dto.items.length !== rows.length || dto.items.some((item) => !ids.has(item.id))) {
      throw new BadRequestException('Reorder payload must include all courses in this level.');
    }
    await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.levelCourse.update({ where: { id: item.id }, data: { sortOrder: index } }),
      ),
    );
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LEVEL_UPDATE,
      entityType: 'LearningLevel',
      entityId: levelId,
      metadata: { reorderCourses: true },
      ...meta,
    });
    return this.get(level.programId);
  }

  async assign(programId: string, dto: AssignProgramDto, actor: AuthenticatedUser, meta?: ClientMeta) {
    const program = await this.get(programId);
    if (program.status !== ProgramStatus.PUBLISHED) {
      throw new BadRequestException('Only published programs can be assigned.');
    }
    this.assertPublishable(program);
    const userIds = await this.resolveAssignScope(dto);
    if (userIds.length === 0) {
      throw new BadRequestException('No active employees match the selected assignment criteria');
    }
    let created = 0;
    for (const userId of [...new Set(userIds)]) {
      const result = await this.enrollUser(program, userId);
      if (result.created) created += 1;
      if (dto.sendNotification) {
        await this.notifications.notify({
          userId,
          title: `Program assigned: ${program.name}`,
          body: `You have been assigned “${program.name}”. Start Level 1 in My Learning.`,
          type: 'PROGRAM_ASSIGNED',
          metadata: { programId },
        });
      }
    }
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.PROGRAM_ASSIGN,
      entityType: 'LearningProgram',
      entityId: programId,
      metadata: { created, assigned: userIds.length, scope: dto.scope },
      ...meta,
    });
    return { created, assigned: userIds.length };
  }

  async myPrograms(userId: string) {
    await this.ensureEnrollmentsFromAssignedCourses(userId);
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { userId, deletedAt: null },
      orderBy: { assignedAt: 'desc' },
    });
    const views = [];
    for (const enrollment of enrollments) {
      await this.progress.syncEnrollment(enrollment.id);
      views.push(toProgramSummary(await this.progress.evaluate(enrollment.id)));
    }
    return views;
  }

  async myProgram(programId: string, userId: string) {
    await this.ensureEnrollmentForProgramIfEligible(programId, userId);
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { programId, userId, deletedAt: null },
    });
    if (!enrollment) throw new NotFoundException('You are not enrolled in this program.');
    await this.progress.syncEnrollment(enrollment.id);
    return toProgramSummary(await this.progress.evaluate(enrollment.id));
  }

  async myLevel(programId: string, levelId: string, userId: string) {
    await this.ensureEnrollmentForProgramIfEligible(programId, userId);
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { programId, userId, deletedAt: null },
    });
    if (!enrollment) throw new NotFoundException('You are not enrolled in this program.');
    await this.progress.syncEnrollment(enrollment.id);
    const view = await this.progress.evaluate(enrollment.id);
    const belongsToProgram = view.levels.some((level) => level.id === levelId);
    if (!belongsToProgram) {
      throw new NotFoundException('Level not found in this program.');
    }
    const detail = toLearnerLevelDetail(view, levelId);
    if (!detail) throw new NotFoundException('Level not found in this program.');
    return detail;
  }

  async myCertificate(programId: string, userId: string) {
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { programId, userId, deletedAt: null },
    });
    if (!enrollment) throw new NotFoundException('You are not enrolled in this program.');
    return this.progress.getCertificateOrThrow(enrollment.id, userId);
  }

  certificateHtml(cert: {
    employeeName: string;
    programName: string;
    organizationName: string;
    certificateCode: string;
    issuedAt: Date;
  }) {
    const date = cert.issuedAt.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `<!doctype html><html><head><meta charset="utf-8"><title>Certificate</title>
<style>body{font-family:Georgia,serif;margin:0;background:#f4f1ea;color:#1f2937}
.sheet{max-width:800px;margin:40px auto;background:#fff;border:12px solid #0f4c5c;padding:48px;text-align:center}
h1{letter-spacing:.2em;font-size:14px;color:#0f4c5c;margin:0 0 24px}
h2{font-size:32px;margin:0 0 8px}p{margin:8px 0;line-height:1.5}
.code{margin-top:32px;font-family:ui-monospace,monospace;font-size:13px;color:#64748b}</style></head>
<body><div class="sheet">
<h1>CERTIFICATE OF COMPLETION</h1>
<p>This certifies that</p>
<h2>${escapeHtml(cert.employeeName)}</h2>
<p>has successfully completed</p>
<h2>${escapeHtml(cert.programName)}</h2>
<p>Completed on ${escapeHtml(date)}</p>
<p>${escapeHtml(cert.organizationName)}</p>
<p class="code">Certificate ID: ${escapeHtml(cert.certificateCode)}</p>
</div></body></html>`;
  }

  private assertPublishable(program: Awaited<ReturnType<ProgramsService['get']>>) {
    const readiness = program.publishReadiness ?? this.computeReadiness(program);
    if (!readiness.ready) {
      throw new BadRequestException(readiness.issues[0] ?? 'Program is not ready to publish.');
    }
  }

  private withReadiness<
    T extends {
      name: string;
      levels: Array<{
        title: string;
        isFinal: boolean;
        courses: Array<{ isRequired: boolean }>;
        finalAssessment?: { status: string; questionCount: number } | null;
      }>;
    },
  >(program: T) {
    return { ...program, publishReadiness: this.computeReadiness(program) };
  }

  private computeReadiness(program: {
    name: string;
    levels: Array<{
      title: string;
      isFinal: boolean;
      courses: Array<{ isRequired: boolean }>;
      finalAssessment?: { status: string; questionCount: number } | null;
    }>;
  }) {
    const error = validateProgramPublish({
      name: program.name,
      levels: program.levels.map((level) => ({
        title: level.title,
        isFinal: level.isFinal,
        requiredCourseCount: level.courses.filter((c) => c.isRequired).length,
        finalAssessmentValid:
          !level.isFinal ||
          (!!level.finalAssessment &&
            level.finalAssessment.status === 'PUBLISHED' &&
            level.finalAssessment.questionCount > 0),
      })),
    });
    return { ready: !error, issues: error ? [error] : [] };
  }

  private async enrollUser(
    program: Awaited<ReturnType<ProgramsService['get']>>,
    userId: string,
  ) {
    const existing = await this.prisma.programEnrollment.findUnique({
      where: { programId_userId: { programId: program.id, userId } },
    });
    let enrollment = existing;
    let created = false;
    if (existing?.deletedAt) {
      enrollment = await this.prisma.programEnrollment.update({
        where: { id: existing.id },
        data: { deletedAt: null, status: 'NOT_STARTED', completedAt: null },
      });
      created = true;
    } else if (!existing) {
      enrollment = await this.prisma.programEnrollment.create({
        data: { programId: program.id, userId },
      });
      created = true;
    }
    if (!enrollment) throw new BadRequestException('Could not create enrollment');

    const firstLevel = program.levels[0];
    for (const level of program.levels) {
      await this.prisma.levelProgress.upsert({
        where: { enrollmentId_levelId: { enrollmentId: enrollment.id, levelId: level.id } },
        create: {
          enrollmentId: enrollment.id,
          levelId: level.id,
          status: level.id === firstLevel?.id ? 'AVAILABLE' : 'LOCKED',
        },
        update: {},
      });
      for (const item of level.courses) {
        const current = await this.prisma.courseAssignment.findUnique({
          where: { courseId_userId: { courseId: item.courseId, userId } },
        });
        if (!current) {
          await this.prisma.courseAssignment.create({
            data: {
              courseId: item.courseId,
              userId,
              programEnrollmentId: enrollment.id,
              status: AssignmentStatus.NOT_STARTED,
            },
          });
        } else if (current.deletedAt) {
          await this.prisma.courseAssignment.update({
            where: { id: current.id },
            data: { deletedAt: null, programEnrollmentId: enrollment.id },
          });
        } else if (current.programEnrollmentId !== enrollment.id) {
          await this.prisma.courseAssignment.update({
            where: { id: current.id },
            data: { programEnrollmentId: enrollment.id },
          });
        }
      }
    }
    await this.progress.syncEnrollment(enrollment.id);
    return { created, enrollment };
  }

  /**
   * Employees often receive courses before a program is assigned.
   * If those courses sit on a non-archived program, create the enrollment
   * so My Learning can render Program → Levels instead of flattening them.
   */
  private async ensureEnrollmentsFromAssignedCourses(userId: string) {
    const assignments = await this.prisma.courseAssignment.findMany({
      where: { userId, deletedAt: null },
      select: { courseId: true },
    });
    const courseIds = [...new Set(assignments.map((row) => row.courseId))];
    if (!courseIds.length) return;

    const links = await this.prisma.levelCourse.findMany({
      where: {
        courseId: { in: courseIds },
        level: {
          deletedAt: null,
          program: {
            deletedAt: null,
            status: { in: [ProgramStatus.DRAFT, ProgramStatus.PUBLISHED] },
          },
        },
      },
      select: { level: { select: { programId: true } } },
    });
    const programIds = [...new Set(links.map((row) => row.level.programId))];
    for (const programId of programIds) {
      const program = await this.get(programId);
      await this.enrollUser(program, userId);
    }
  }

  private async ensureEnrollmentForProgramIfEligible(programId: string, userId: string) {
    const existing = await this.prisma.programEnrollment.findFirst({
      where: { programId, userId, deletedAt: null },
    });
    if (existing) return;

    const program = await this.prisma.learningProgram.findFirst({
      where: { id: programId, deletedAt: null },
      select: { status: true },
    });
    if (!program || program.status === ProgramStatus.ARCHIVED) return;

    const courseIds = (
      await this.prisma.levelCourse.findMany({
        where: { level: { programId, deletedAt: null } },
        select: { courseId: true },
      })
    ).map((row) => row.courseId);
    if (!courseIds.length) return;

    const assigned = await this.prisma.courseAssignment.findFirst({
      where: { userId, deletedAt: null, courseId: { in: courseIds } },
    });
    if (!assigned) return;

    await this.enrollUser(await this.get(programId), userId);
  }

  private async resolveAssignScope(dto: AssignProgramDto): Promise<string[]> {
    const base = { deletedAt: null as Date | null, status: UserStatus.ACTIVE };
    if (dto.scope === AssignScope.ALL_EMPLOYEES) {
      const users = await this.prisma.user.findMany({
        where: { ...base, role: AppRole.EMPLOYEE },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (dto.scope === AssignScope.DEPARTMENT && dto.departmentIds?.length) {
      const users = await this.prisma.user.findMany({
        where: { ...base, departmentId: { in: dto.departmentIds } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    if (dto.scope === AssignScope.ROLE && dto.roles?.length) {
      const users = await this.prisma.user.findMany({
        where: { ...base, role: { in: dto.roles } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }
    return dto.userIds ?? [];
  }

  private async clearOtherFinals(programId: string, exceptId?: string) {
    await this.prisma.learningLevel.updateMany({
      where: { programId, deletedAt: null, id: exceptId ? { not: exceptId } : undefined },
      data: { isFinal: false },
    });
  }

  private async renumberLevels(programId: string) {
    const levels = await this.prisma.learningLevel.findMany({
      where: { programId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    await this.prisma.$transaction(
      levels.map((level, index) =>
        this.prisma.learningLevel.update({ where: { id: level.id }, data: { sortOrder: index } }),
      ),
    );
  }

  private async requireProgram(id: string) {
    const program = await this.prisma.learningProgram.findFirst({
      where: { id, deletedAt: null },
    });
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  private async requireLevel(id: string) {
    const level = await this.prisma.learningLevel.findFirst({
      where: { id, deletedAt: null },
    });
    if (!level) throw new NotFoundException('Level not found');
    return level;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
