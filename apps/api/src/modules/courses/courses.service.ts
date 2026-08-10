import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssignmentRuleTargetType,
  CourseStatus,
  LessonType,
  MediaKind,
  Prisma,
  QuizStatus,
} from '@prisma/client';
import {
  buildPaginatedResult,
  paginationSkip,
} from '../../common/utils/pagination.util';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { LearningService } from '../learning/learning.service';
import { CreateAssignmentRuleDto } from './dto/create-assignment-rule.dto';
import { CreateCourseDto } from './dto/create-course.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { ListCoursesQueryDto } from './dto/list-courses-query.dto';
import { ReorderDto } from './dto/reorder.dto';
import { UpdateAssignmentRuleDto } from './dto/update-assignment-rule.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

const courseDetailInclude = {
  thumbnailMedia: true,
  modules: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: {
      lessons: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          contentMedia: true,
          quiz: {
            where: { deletedAt: null },
            select: {
              id: true,
              title: true,
              passingScore: true,
              maxAttempts: true,
              status: true,
              showCorrectAnswers: true,
              _count: {
                select: { questions: { where: { deletedAt: null } } },
              },
            },
          },
        },
      },
    },
  },
  assignmentRules: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' as const },
    include: {
      department: { select: { id: true, name: true, code: true } },
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
} satisfies Prisma.CourseInclude;

type ClientMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly mediaService: MediaService,
    private readonly learningService: LearningService,
  ) {}

  async createCourse(
    dto: CreateCourseDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.ensureCourseCodeAvailable(dto.code);
    if (dto.thumbnailMediaId) {
      await this.mediaService.requireMedia(dto.thumbnailMediaId, [
        MediaKind.THUMBNAIL,
      ]);
    }

    const course = await this.prisma.course.create({
      data: {
        title: dto.title.trim(),
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim() || null,
        isMandatory: dto.isMandatory ?? true,
        estimatedMinutes: dto.estimatedMinutes ?? null,
        thumbnailMediaId: dto.thumbnailMediaId ?? null,
        createdById: actor.userId,
        status: CourseStatus.DRAFT,
      },
      include: courseDetailInclude,
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.COURSE_CREATE,
      entityType: 'Course',
      entityId: course.id,
      metadata: { code: course.code },
      ...meta,
    });

    return course;
  }

  async listCourses(query: ListCoursesQueryDto) {
    const where: Prisma.CourseWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        include: {
          thumbnailMedia: true,
          _count: {
            select: {
              modules: { where: { deletedAt: null } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: paginationSkip(query.page, query.pageSize),
        take: query.pageSize,
      }),
    ]);

    return buildPaginatedResult(items, totalItems, query.page, query.pageSize);
  }

  async getCourse(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: courseDetailInclude,
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  async updateCourse(
    id: string,
    dto: UpdateCourseDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const existing = await this.requireCourse(id);
    if (dto.code && dto.code.toUpperCase() !== existing.code) {
      await this.ensureCourseCodeAvailable(dto.code, id);
    }
    if (dto.thumbnailMediaId) {
      await this.mediaService.requireMedia(dto.thumbnailMediaId, [
        MediaKind.THUMBNAIL,
      ]);
    }

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        code: dto.code?.trim().toUpperCase(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        isMandatory: dto.isMandatory,
        estimatedMinutes: dto.estimatedMinutes,
        thumbnailMediaId: dto.thumbnailMediaId,
      },
      include: courseDetailInclude,
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.COURSE_UPDATE,
      entityType: 'Course',
      entityId: id,
      metadata: { fields: Object.keys(dto) },
      ...meta,
    });

    return course;
  }

  async updateStatus(
    id: string,
    status: CourseStatus,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireCourse(id);

    if (status === CourseStatus.PUBLISHED) {
      await this.assertPublishable(id);
    }

    const course = await this.prisma.course.update({
      where: { id },
      data: {
        status,
        publishedAt:
          status === CourseStatus.PUBLISHED ? new Date() : undefined,
      },
      include: courseDetailInclude,
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.COURSE_STATUS_CHANGE,
      entityType: 'Course',
      entityId: id,
      metadata: { status },
      ...meta,
    });

    return course;
  }

  async softDeleteCourse(
    id: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireCourse(id);
    await this.prisma.course.update({
      where: { id },
      data: { deletedAt: new Date(), status: CourseStatus.ARCHIVED },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.COURSE_SOFT_DELETE,
      entityType: 'Course',
      entityId: id,
      ...meta,
    });
    return { id, deleted: true };
  }

  async createModule(
    courseId: string,
    dto: CreateModuleDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireCourse(courseId);
    const max = await this.prisma.courseModule.aggregate({
      where: { courseId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const module = await this.prisma.courseModule.create({
      data: {
        courseId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      include: {
        lessons: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.MODULE_CREATE,
      entityType: 'CourseModule',
      entityId: module.id,
      metadata: { courseId },
      ...meta,
    });

    return module;
  }

  async updateModule(
    moduleId: string,
    dto: UpdateModuleDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireModule(moduleId);
    const module = await this.prisma.courseModule.update({
      where: { id: moduleId },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        sortOrder: dto.sortOrder,
      },
      include: {
        lessons: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.MODULE_UPDATE,
      entityType: 'CourseModule',
      entityId: moduleId,
      ...meta,
    });

    return module;
  }

  async reorderModules(
    courseId: string,
    dto: ReorderDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireCourse(courseId);
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId, deletedAt: null },
    });
    const ids = new Set(modules.map((m) => m.id));
    if (dto.items.some((item) => !ids.has(item.id)) || dto.items.length !== modules.length) {
      throw new BadRequestException('Reorder payload must include all modules');
    }

    await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.courseModule.update({
          where: { id: item.id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.MODULE_REORDER,
      entityType: 'Course',
      entityId: courseId,
      ...meta,
    });

    return this.getCourse(courseId);
  }

  async softDeleteModule(
    moduleId: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireModule(moduleId);
    await this.prisma.courseModule.update({
      where: { id: moduleId },
      data: { deletedAt: new Date() },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.MODULE_SOFT_DELETE,
      entityType: 'CourseModule',
      entityId: moduleId,
      ...meta,
    });
    return { id: moduleId, deleted: true };
  }

  async listCourseLessons(courseId: string) {
    await this.requireCourse(courseId);
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        lessons: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: { contentMedia: true },
        },
      },
    });
    return modules.flatMap((mod, moduleIndex) =>
      mod.lessons.map((lesson, lessonIndex) => ({
        ...lesson,
        courseId,
        moduleTitle: mod.title,
        sortOrder: modules
          .slice(0, moduleIndex)
          .reduce((sum, item) => sum + item.lessons.length, 0) + lessonIndex,
      })),
    );
  }

  async getLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: {
        contentMedia: true,
        module: { select: { id: true, courseId: true, title: true } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  async createCourseLesson(
    courseId: string,
    dto: CreateLessonDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const module = await this.ensurePrimaryModule(courseId);
    return this.createLesson(module.id, dto, actor, meta);
  }

  async reorderCourseLessons(
    courseId: string,
    dto: ReorderDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireCourse(courseId);
    const module = await this.ensurePrimaryModule(courseId);
    const lessons = await this.prisma.lesson.findMany({
      where: { module: { courseId, deletedAt: null }, deletedAt: null },
    });
    if (lessons.length === 0) {
      throw new BadRequestException('No lessons exist in this course to reorder.');
    }
    if (!dto.items?.length || dto.items.length !== lessons.length) {
      throw new BadRequestException('Reorder payload must include all course lessons');
    }
    const ids = new Set(lessons.map((l) => l.id));
    if (dto.items.some((item) => !ids.has(item.id))) {
      throw new BadRequestException('Reorder includes a lesson that is not in this course');
    }

    await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.lesson.update({
          where: { id: item.id },
          data: { sortOrder: index, moduleId: module.id },
        }),
      ),
    );

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LESSON_REORDER,
      entityType: 'Course',
      entityId: courseId,
      ...meta,
    });

    return this.listCourseLessons(courseId);
  }

  async createLesson(
    moduleId: string,
    dto: CreateLessonDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireModule(moduleId);
    await this.validateLessonMedia(dto.type, dto.contentMediaId);

    const max = await this.prisma.lesson.aggregate({
      where: { moduleId, deletedAt: null },
      _max: { sortOrder: true },
    });

    const lesson = await this.prisma.lesson.create({
      data: {
        moduleId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        type: dto.type,
        status: dto.status ?? undefined,
        contentMediaId: dto.contentMediaId ?? null,
        durationSeconds: dto.durationSeconds ?? null,
        quizConfig: (dto.quizConfig ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        sortOrder: dto.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      include: { contentMedia: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LESSON_CREATE,
      entityType: 'Lesson',
      entityId: lesson.id,
      metadata: { moduleId, type: lesson.type },
      ...meta,
    });

    return lesson;
  }

  async updateLesson(
    lessonId: string,
    dto: UpdateLessonDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const existing = await this.requireLesson(lessonId);
    const type = dto.type ?? existing.type;
    const mediaId =
      dto.contentMediaId === undefined
        ? existing.contentMediaId
        : dto.contentMediaId;
    await this.validateLessonMedia(type, mediaId ?? undefined);

    const lesson = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        title: dto.title?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
        type: dto.type,
        status: dto.status,
        contentMediaId: dto.contentMediaId,
        durationSeconds: dto.durationSeconds,
        quizConfig:
          dto.quizConfig === undefined
            ? undefined
            : ((dto.quizConfig ?? Prisma.JsonNull) as Prisma.InputJsonValue),
        sortOrder: dto.sortOrder,
      },
      include: { contentMedia: true },
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LESSON_UPDATE,
      entityType: 'Lesson',
      entityId: lessonId,
      ...meta,
    });

    return lesson;
  }

  async reorderLessons(
    moduleId: string,
    dto: ReorderDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireModule(moduleId);
    const lessons = await this.prisma.lesson.findMany({
      where: { moduleId, deletedAt: null },
    });

    if (lessons.length === 0) {
      throw new BadRequestException(
        'No lessons exist in this module to reorder. Create lessons before reordering.',
      );
    }

    if (!dto.items?.length) {
      throw new BadRequestException(
        'Cannot reorder lessons: items is empty. Create at least one lesson before reordering.',
      );
    }

    const ids = new Set(lessons.map((l) => l.id));
    if (
      dto.items.some((item) => !ids.has(item.id)) ||
      dto.items.length !== lessons.length
    ) {
      throw new BadRequestException('Reorder payload must include all lessons');
    }

    await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.lesson.update({
          where: { id: item.id },
          data: { sortOrder: index },
        }),
      ),
    );

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LESSON_REORDER,
      entityType: 'CourseModule',
      entityId: moduleId,
      ...meta,
    });

    return this.prisma.lesson.findMany({
      where: { moduleId, deletedAt: null },
      include: { contentMedia: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async softDeleteLesson(
    lessonId: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireLesson(lessonId);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { deletedAt: new Date() },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.LESSON_SOFT_DELETE,
      entityType: 'Lesson',
      entityId: lessonId,
      ...meta,
    });
    return { id: lessonId, deleted: true };
  }

  async createAssignmentRule(
    courseId: string,
    dto: CreateAssignmentRuleDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requirePublishedCourse(courseId);
    this.validateAssignmentRuleTargets(dto);

    const rule = await this.prisma.courseAssignmentRule.create({
      data: {
        courseId,
        targetType: dto.targetType,
        departmentId:
          dto.targetType === AssignmentRuleTargetType.DEPARTMENT
            ? dto.departmentId!
            : null,
        userId:
          dto.targetType === AssignmentRuleTargetType.EMPLOYEE
            ? dto.userId!
            : null,
        dueInDays: dto.dueInDays ?? null,
        isActive: dto.isActive ?? true,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSIGNMENT_RULE_CREATE,
      entityType: 'CourseAssignmentRule',
      entityId: rule.id,
      metadata: { courseId, targetType: rule.targetType },
      ...meta,
    });

    // Enterprise flow: creating a rule immediately materializes learner assignments
    const materialized = await this.learningService.materializeRule(
      rule,
      actor,
      meta,
    );

    return {
      ...rule,
      assignmentsCreated: materialized.created,
      learnersTargeted: materialized.learnersTargeted,
    };
  }

  async updateAssignmentRule(
    ruleId: string,
    dto: UpdateAssignmentRuleDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const existing = await this.prisma.courseAssignmentRule.findFirst({
      where: { id: ruleId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Assignment rule not found');
    }
    await this.requirePublishedCourse(existing.courseId);

    const targetType = dto.targetType ?? existing.targetType;
    this.validateAssignmentRuleTargets({
      targetType,
      departmentId:
        dto.departmentId === undefined
          ? existing.departmentId ?? undefined
          : dto.departmentId ?? undefined,
      userId:
        dto.userId === undefined
          ? existing.userId ?? undefined
          : dto.userId ?? undefined,
    });

    const rule = await this.prisma.courseAssignmentRule.update({
      where: { id: ruleId },
      data: {
        targetType: dto.targetType,
        departmentId: dto.departmentId,
        userId: dto.userId,
        dueInDays: dto.dueInDays,
        isActive: dto.isActive,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSIGNMENT_RULE_UPDATE,
      entityType: 'CourseAssignmentRule',
      entityId: ruleId,
      ...meta,
    });

    return rule;
  }

  async softDeleteAssignmentRule(
    ruleId: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const existing = await this.prisma.courseAssignmentRule.findFirst({
      where: { id: ruleId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Assignment rule not found');
    }
    await this.prisma.courseAssignmentRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSIGNMENT_RULE_SOFT_DELETE,
      entityType: 'CourseAssignmentRule',
      entityId: ruleId,
      ...meta,
    });
    return { id: ruleId, deleted: true };
  }

  async dashboardStats() {
    const [draft, published, archived, total] = await Promise.all([
      this.prisma.course.count({
        where: { deletedAt: null, status: CourseStatus.DRAFT },
      }),
      this.prisma.course.count({
        where: { deletedAt: null, status: CourseStatus.PUBLISHED },
      }),
      this.prisma.course.count({
        where: { deletedAt: null, status: CourseStatus.ARCHIVED },
      }),
      this.prisma.course.count({ where: { deletedAt: null } }),
    ]);

    return { total, draft, published, archived };
  }

  private async assertPublishable(courseId: string) {
    const course = await this.getCourse(courseId);

    if (!course.title?.trim() || course.title.trim().length < 3) {
      throw new BadRequestException('Publish requires a course title (min 3 characters)');
    }
    if (!course.code?.trim() || course.code.trim().length < 2) {
      throw new BadRequestException('Publish requires a course code');
    }

    if (course.modules.length === 0) {
      throw new BadRequestException('Publish requires at least one module');
    }
    const lessons = course.modules.flatMap((m) => m.lessons);
    if (lessons.length === 0) {
      throw new BadRequestException('Publish requires at least one lesson');
    }

    const mediaLessons = lessons.filter(
      (l) => l.type === LessonType.PDF || l.type === LessonType.VIDEO,
    );
    if (mediaLessons.length === 0) {
      throw new BadRequestException(
        'Publish requires at least one PDF or video lesson with uploaded content',
      );
    }

    for (const lesson of lessons) {
      if (
        (lesson.type === LessonType.PDF || lesson.type === LessonType.VIDEO) &&
        !lesson.contentMediaId
      ) {
        throw new BadRequestException(
          `Lesson "${lesson.title}" requires uploaded ${lesson.type} content before publish`,
        );
      }

      if (
        (lesson.type === LessonType.PDF || lesson.type === LessonType.VIDEO) &&
        lesson.contentMediaId
      ) {
        const expected =
          lesson.type === LessonType.PDF
            ? [MediaKind.DOCUMENT]
            : [MediaKind.VIDEO];
        try {
          await this.mediaService.requireMedia(lesson.contentMediaId, expected);
        } catch {
          throw new BadRequestException(
            `Lesson "${lesson.title}" has a broken media reference — re-upload the ${lesson.type} content`,
          );
        }
      }

      const assessment = lesson.quiz;
      if (assessment) {
        if (assessment.status !== QuizStatus.PUBLISHED) {
          throw new BadRequestException(
            `Publish assessment for "${lesson.title}" before publishing the course`,
          );
        }
        if ((assessment._count?.questions ?? 0) < 1) {
          throw new BadRequestException(
            `Assessment for "${lesson.title}" needs at least one question`,
          );
        }
      }
    }
  }

  private async requirePublishedCourse(courseId: string) {
    const course = await this.requireCourse(courseId);
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException(
        'Only published courses can be assigned. Publish the course before creating assignment rules.',
      );
    }
    return course;
  }

  private async validateLessonMedia(
    type: LessonType,
    contentMediaId?: string | null,
  ) {
    if (type === LessonType.QUIZ) {
      return;
    }
    if (!contentMediaId) {
      return;
    }
    const expected =
      type === LessonType.PDF ? [MediaKind.DOCUMENT] : [MediaKind.VIDEO];
    await this.mediaService.requireMedia(contentMediaId, expected);
  }

  private validateAssignmentRuleTargets(dto: {
    targetType: AssignmentRuleTargetType;
    departmentId?: string | null;
    userId?: string | null;
  }) {
    if (
      dto.targetType === AssignmentRuleTargetType.DEPARTMENT &&
      !dto.departmentId
    ) {
      throw new BadRequestException('departmentId is required for DEPARTMENT rules');
    }
    if (dto.targetType === AssignmentRuleTargetType.EMPLOYEE && !dto.userId) {
      throw new BadRequestException('userId is required for EMPLOYEE rules');
    }
  }

  private async ensureCourseCodeAvailable(code: string, excludeId?: string) {
    const existing = await this.prisma.course.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('Course code is already in use');
    }
  }

  private async ensurePrimaryModule(courseId: string) {
    await this.requireCourse(courseId);
    const existing = await this.prisma.courseModule.findFirst({
      where: { courseId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.courseModule.create({
      data: {
        courseId,
        title: 'Course Content',
        sortOrder: 0,
      },
    });
  }

  private async requireCourse(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
  }

  private async requireModule(id: string) {
    const module = await this.prisma.courseModule.findFirst({
      where: { id, deletedAt: null },
    });
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    return module;
  }

  private async requireLesson(id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id, deletedAt: null },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }
}
