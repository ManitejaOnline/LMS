import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppRole,
  AssignmentRuleTargetType,
  AssignmentStatus,
  CourseStatus,
  LessonProgressStatus,
  LessonType,
  Prisma,
  QuizStatus,
  UserStatus,
} from '@prisma/client';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { NotificationService } from '../../infrastructure/notifications/notification.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AssignCourseDto, AssignScope } from './dto/assign-course.dto';
import {
  IngestLearningEventsDto,
  LearningEventDto,
} from './dto/ingest-learning-events.dto';
import {
  PDF_PAGE_REQUIRED_SECONDS,
  VIDEO_COMPLETION_PERCENT,
} from './learning.constants';
import { PageProgressService } from './page-progress.service';
import type { LearnerLessonProgressDto } from './dto/learner-lesson-progress.dto';
import { SequentialAccessService } from './sequential-access.service';
import { ProgramProgressService } from '../programs/program-progress.service';
import {
  firstUnlockedIncompleteLessonId,
  isLessonSequentiallyLocked,
} from './sequential-lessons.util';

const coursePlayerInclude = {
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
              questionCount: true,
              _count: { select: { questions: { where: { deletedAt: null } } } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CourseInclude;

type ClientMeta = { ipAddress?: string; userAgent?: string };

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly pageProgress: PageProgressService,
    private readonly sequentialAccess: SequentialAccessService,
    private readonly programProgress: ProgramProgressService,
  ) {}

  async applyRules(
    courseId: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requirePublishedCourse(courseId);
    const rules = await this.prisma.courseAssignmentRule.findMany({
      where: { courseId, deletedAt: null, isActive: true },
    });

    if (rules.length === 0) {
      throw new BadRequestException(
        'Add at least one assignment rule before applying to learners',
      );
    }

    let created = 0;
    for (const rule of rules) {
      const result = await this.materializeRule(rule, actor, meta, {
        writeAudit: false,
      });
      created += result.created;
    }

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSIGNMENT_APPLY_RULES,
      entityType: 'Course',
      entityId: courseId,
      metadata: { rules: rules.length, created },
      ...meta,
    });

    return { created, rulesApplied: rules.length };
  }

  /**
   * Creates CourseAssignment rows for everyone targeted by a single rule.
   * Called when a rule is created and when Apply Rules re-syncs learners.
   */
  async materializeRule(
    rule:
      | string
      | {
          id: string;
          courseId: string;
          targetType: AssignmentRuleTargetType;
          departmentId: string | null;
          userId: string | null;
          dueInDays: number | null;
          isActive: boolean;
          deletedAt: Date | null;
        },
    actor: AuthenticatedUser,
    meta?: ClientMeta,
    options?: { writeAudit?: boolean },
  ) {
    const resolved =
      typeof rule === 'string'
        ? await this.prisma.courseAssignmentRule.findFirst({
            where: { id: rule, deletedAt: null },
          })
        : rule;

    if (!resolved || resolved.deletedAt) {
      throw new NotFoundException('Assignment rule not found');
    }
    if (!resolved.isActive) {
      return { created: 0, learnersTargeted: 0 };
    }

    await this.requirePublishedCourse(resolved.courseId);
    const userIds = await this.resolveRuleUserIds(resolved);
    let created = 0;

    for (const userId of userIds) {
      const dueAt = resolved.dueInDays
        ? new Date(Date.now() + resolved.dueInDays * 86_400_000)
        : null;
      const result = await this.upsertAssignment({
        courseId: resolved.courseId,
        userId,
        ruleId: resolved.id,
        dueAt,
      });
      if (result.created) created += 1;
    }

    if (options?.writeAudit !== false) {
      await this.audit.write({
        actorId: actor.userId,
        action: AuditActions.ASSIGNMENT_APPLY_RULES,
        entityType: 'CourseAssignmentRule',
        entityId: resolved.id,
        metadata: {
          courseId: resolved.courseId,
          created,
          learnersTargeted: userIds.length,
        },
        ...meta,
      });
    }

    return { created, learnersTargeted: userIds.length };
  }

  async assignCourse(
    courseId: string,
    dto: AssignCourseDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    let course = await this.requirePublishedCourse(courseId);

    if (
      dto.isMandatory !== undefined &&
      dto.isMandatory !== course.isMandatory
    ) {
      course = await this.prisma.course.update({
        where: { id: course.id },
        data: { isMandatory: dto.isMandatory },
      });
    }

    const userIds = await this.resolveAssignScope(dto);
    if (userIds.length === 0) {
      throw new BadRequestException(
        'No active employees match the selected assignment criteria',
      );
    }

    const dueAt = this.resolveDueAt(dto);
    const dueInDaysForRule = this.resolveDueInDays(dto);
    const uniqueUserIds = [...new Set(userIds)];

    let linkedRuleId: string | null = null;
    if (dto.notifyNewEmployees) {
      const ruleIds = await this.ensureAutoEnrollRules(
        course.id,
        dto,
        dueInDaysForRule,
      );
      linkedRuleId = ruleIds[0] ?? null;
    }

    let created = 0;
    for (const userId of uniqueUserIds) {
      const result = await this.upsertAssignment({
        courseId: course.id,
        userId,
        ruleId: linkedRuleId,
        dueAt,
      });
      if (result.created) created += 1;
    }

    if (dto.sendNotification) {
      for (const userId of uniqueUserIds) {
        await this.notifications.notify({
          userId,
          title: `Course assigned: ${course.title}`,
          body: `You have been assigned “${course.title}”. Open My Learning to begin.`,
          type: 'COURSE_ASSIGNED',
          metadata: { courseId: course.id },
        });
      }
    }

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSIGNMENT_CREATE,
      entityType: 'Course',
      entityId: courseId,
      metadata: {
        scope: dto.scope,
        created,
        assigned: uniqueUserIds.length,
        sendNotification: !!dto.sendNotification,
        notifyNewEmployees: !!dto.notifyNewEmployees,
      },
      ...meta,
    });

    const summary = await this.assignmentStats(courseId);
    return {
      created,
      ...summary,
    };
  }

  async assignmentStats(courseId: string) {
    await this.requirePublishedCourse(courseId);
    const base = { courseId, deletedAt: null as Date | null };
    const [assigned, completed, inProgress, notStarted] = await Promise.all([
      this.prisma.courseAssignment.count({ where: base }),
      this.prisma.courseAssignment.count({
        where: { ...base, status: AssignmentStatus.COMPLETED },
      }),
      this.prisma.courseAssignment.count({
        where: { ...base, status: AssignmentStatus.IN_PROGRESS },
      }),
      this.prisma.courseAssignment.count({
        where: { ...base, status: AssignmentStatus.NOT_STARTED },
      }),
    ]);
    return { assigned, completed, inProgress, notStarted };
  }

  async myAssignments(userId: string) {
    const items = await this.prisma.courseAssignment.findMany({
      where: {
        userId,
        deletedAt: null,
        course: {
          deletedAt: null,
          status: CourseStatus.PUBLISHED,
        },
      },
      include: {
        course: {
          include: {
            thumbnailMedia: true,
            _count: {
              select: { modules: { where: { deletedAt: null } } },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });

    return items.map((item) => ({
      ...item,
      isOverdue:
        !!item.dueAt &&
        item.dueAt < new Date() &&
        item.status !== AssignmentStatus.COMPLETED,
    }));
  }

  async employeeDashboard(userId: string) {
    const assignments = await this.myAssignments(userId);
    return {
      total: assignments.length,
      notStarted: assignments.filter(
        (a) => a.status === AssignmentStatus.NOT_STARTED,
      ).length,
      inProgress: assignments.filter(
        (a) => a.status === AssignmentStatus.IN_PROGRESS,
      ).length,
      completed: assignments.filter(
        (a) => a.status === AssignmentStatus.COMPLETED,
      ).length,
      overdue: assignments.filter((a) => a.isOverdue).length,
      recent: assignments.slice(0, 6),
    };
  }

  async getPlayer(assignmentId: string, user: AuthenticatedUser) {
    const assignment = await this.requireOwnedAssignment(assignmentId, user, {
      allowAdminRead: true,
    });
    const course = await this.prisma.course.findFirst({
      where: { id: assignment.courseId, deletedAt: null },
      include: coursePlayerInclude,
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const progress = await this.prisma.lessonProgress.findMany({
      where: { assignmentId },
    });

    const pageProgress = await this.prisma.pageProgress.findMany({
      where: { assignmentId, userId: assignment.userId },
      orderBy: [{ lessonId: 'asc' }, { pageNumber: 'asc' }],
    });

    const gate = await this.sequentialAccess.loadSequenceState(
      assignment.id,
      assignment.courseId,
    );

    const attempts = await this.prisma.quizAttempt.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { attemptNumber: 'desc' },
      select: {
        id: true,
        quizId: true,
        attemptNumber: true,
        score: true,
        passed: true,
        submittedAt: true,
      },
    });

    const flatLessons = course.modules.flatMap((m) =>
      m.lessons
        .filter((lesson) => lesson.type !== LessonType.QUIZ)
        .map((lesson) => ({
          ...lesson,
          moduleId: m.id,
          moduleTitle: m.title,
        })),
    );

    const lessons = flatLessons.map((lesson) => {
      const { quiz, ...rest } = lesson;
      const locked = isLessonSequentiallyLocked(
        gate.lessons,
        lesson.id,
        gate.completedIds,
        gate.passedAssessmentIds,
      );
      return {
        ...rest,
        locked,
        assessment: this.toPlayerAssessment(
          quiz,
          attempts,
          gate.completedIds.has(lesson.id),
          locked,
        ),
      };
    });

    const preferredResume =
      assignment.lastLessonId &&
      !isLessonSequentiallyLocked(
        gate.lessons,
        assignment.lastLessonId,
        gate.completedIds,
        gate.passedAssessmentIds,
      )
        ? assignment.lastLessonId
        : firstUnlockedIncompleteLessonId(
            gate.lessons,
            gate.completedIds,
            gate.passedAssessmentIds,
          );

    return {
      assignment,
      course,
      lessons,
      progress,
      pageProgress: pageProgress.map((p) => ({
        id: p.id,
        lessonId: p.lessonId,
        employeeId: p.userId,
        pageNumber: p.pageNumber,
        requiredSeconds: p.requiredSeconds,
        completedSeconds: p.completedSeconds,
        remainingSeconds: Math.max(0, p.requiredSeconds - p.completedSeconds),
        completed: p.completed,
        startedAt: p.startedAt,
        completedAt: p.completedAt,
        pauseCount: p.pauseCount,
        totalPausedSec: p.totalPausedSec,
        focusLostCount: p.focusLostCount,
        tabSwitchCount: p.tabSwitchCount,
        hiddenCount: p.hiddenCount,
        idleCount: p.idleCount,
      })),
      requiredSecondsPerPage: PDF_PAGE_REQUIRED_SECONDS,
      videoCompletionPercent: VIDEO_COMPLETION_PERCENT,
      resumeLessonId: preferredResume,
    };
  }

  async listLearnerCourseLessons(courseId: string, user: AuthenticatedUser) {
    const assignment = await this.requireEnrollment(courseId, user);
    const player = await this.getPlayer(assignment.id, user);
    return {
      assignmentId: assignment.id,
      lessons: player.lessons,
      progress: player.progress,
      resumeLessonId: player.resumeLessonId,
    };
  }

  async getLearnerLessonProgress(lessonId: string, user: AuthenticatedUser) {
    const assignment = await this.requireEnrollmentForLesson(lessonId, user);
    await this.assertLessonAccessible(assignment.id, assignment.courseId, lessonId);
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { assignmentId_lessonId: { assignmentId: assignment.id, lessonId } },
    });
    return { assignmentId: assignment.id, lessonId, progress };
  }

  async saveLearnerLessonProgress(
    lessonId: string,
    dto: LearnerLessonProgressDto,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.requireEnrollmentForLesson(lessonId, user);
    await this.assertLessonAccessible(assignment.id, assignment.courseId, lessonId);
    return this.ingestEvents(
      assignment.id,
      {
        events: [
          {
            eventType: 'VIDEO_PROGRESS',
            lessonId,
            occurredAt: new Date().toISOString(),
            payload: {
              currentTime: dto.resumePositionSec,
              watchPercentage: dto.watchPercentage,
            },
          },
        ],
      },
      user,
    );
  }

  async completeLearnerLesson(lessonId: string, user: AuthenticatedUser) {
    const assignment = await this.requireEnrollmentForLesson(lessonId, user);
    return this.markLessonComplete(assignment.id, lessonId, user);
  }

  async resumePdfLesson(
    assignmentId: string,
    lessonId: string,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.requireOwnedAssignment(assignmentId, user);
    await this.ensureLessonBelongsToCourse(assignment.courseId, lessonId);
    await this.assertLessonAccessible(assignment.id, assignment.courseId, lessonId);

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
    });
    if (!lesson || lesson.type !== LessonType.PDF) {
      throw new BadRequestException('Resume applies only to PDF lessons');
    }

    const list = await this.pageProgress.listPageProgress(
      assignmentId,
      lessonId,
      user,
    );
    const lessonProgress = await this.prisma.lessonProgress.findUnique({
      where: { assignmentId_lessonId: { assignmentId, lessonId } },
    });

    const incomplete = list.pages.find((p) => !p.completed);
    const lastPage =
      incomplete?.pageNumber ??
      lessonProgress?.currentPage ??
      list.pages[list.pages.length - 1]?.pageNumber ??
      1;

    const current =
      list.pages.find((p) => p.pageNumber === lastPage) ?? null;

    return {
      requiredSecondsPerPage: PDF_PAGE_REQUIRED_SECONDS,
      lastPage,
      remainingSeconds: current
        ? current.remainingSeconds
        : PDF_PAGE_REQUIRED_SECONDS,
      completedSeconds: current?.completedSeconds ?? 0,
      pages: list.pages,
      lessonProgress,
    };
  }

  async ingestEvents(
    assignmentId: string,
    dto: IngestLearningEventsDto,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.requireOwnedAssignment(assignmentId, user);

    for (const event of dto.events) {
      await this.processEvent(assignment.id, user.userId, event);
    }

    const refreshed = await this.recalculateAssignmentProgress(assignment.id);
    return {
      assignment: refreshed,
      progress: await this.prisma.lessonProgress.findMany({
        where: { assignmentId: assignment.id },
      }),
    };
  }

  async timeline(assignmentId: string, user: AuthenticatedUser) {
    await this.requireOwnedAssignment(assignmentId, user);
    return this.prisma.learningEvent.findMany({
      where: { assignmentId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async markLessonComplete(
    assignmentId: string,
    lessonId: string,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.requireOwnedAssignment(assignmentId, user);
    const lesson = await this.ensureLessonBelongsToCourse(
      assignment.courseId,
      lessonId,
    );
    await this.assertLessonAccessible(assignment.id, assignment.courseId, lessonId);

    const progress = await this.upsertLessonProgress(
      assignment.id,
      lessonId,
      user.userId,
    );

    if (lesson.type === LessonType.VIDEO) {
      if ((progress.watchPercentage ?? 0) < VIDEO_COMPLETION_PERCENT) {
        throw new ForbiddenException(
          `Watch at least ${VIDEO_COMPLETION_PERCENT}% of the video before completing this lesson.`,
        );
      }
    }

    if (lesson.type === LessonType.PDF) {
      const bounds = this.readPdfChapterBounds(lesson.quizConfig);
      const pageStart = bounds?.pageStart ?? 1;
      const pageEnd =
        bounds?.pageEnd ??
        progress.totalPages ??
        null;
      if (!pageEnd || pageEnd < pageStart) {
        throw new ForbiddenException(
          'PDF page range unknown. Open every page and finish the reading timer before completing.',
        );
      }
      await this.pageProgress.ensureAllPagesCompleteForLesson(
        assignment.id,
        lessonId,
        user.userId,
        pageStart,
        pageEnd,
      );
    }

    const updated = await this.prisma.lessonProgress.update({
      where: { id: progress.id },
      data: {
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
        watchPercentage: 100,
        scrollPercentage: 100,
        lastEventAt: new Date(),
      },
    });

    await this.prisma.learningEvent.create({
      data: {
        assignmentId,
        lessonId,
        userId: user.userId,
        eventType: 'LESSON_COMPLETED',
        occurredAt: new Date(),
        payload: { source: 'manual_or_threshold' },
      },
    });

    await this.audit.write({
      actorId: user.userId,
      action: AuditActions.LESSON_MARK_COMPLETED,
      entityType: 'Lesson',
      entityId: lessonId,
      metadata: { assignmentId },
    });

    const assignmentState = await this.recalculateAssignmentProgress(
      assignment.id,
    );

    return { progress: updated, assignment: assignmentState };
  }

  private async processEvent(
    assignmentId: string,
    userId: string,
    event: LearningEventDto,
  ) {
    if (event.clientEventId) {
      const existing = await this.prisma.learningEvent.findUnique({
        where: { clientEventId: event.clientEventId },
      });
      if (existing) {
        return;
      }
    }

    if (event.lessonId) {
      const assignment = await this.prisma.courseAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
      await this.ensureLessonBelongsToCourse(assignment.courseId, event.lessonId);
      await this.assertLessonAccessible(
        assignment.id,
        assignment.courseId,
        event.lessonId,
      );
    }

    try {
      await this.prisma.learningEvent.create({
        data: {
          assignmentId,
          lessonId: event.lessonId ?? null,
          userId,
          eventType: event.eventType,
          occurredAt: new Date(event.occurredAt),
          payload: (event.payload ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          clientEventId: event.clientEventId ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }

    if (!event.lessonId) {
      return;
    }

    const progress = await this.upsertLessonProgress(
      assignmentId,
      event.lessonId,
      userId,
    );

    const payload = event.payload ?? {};
    const data: Prisma.LessonProgressUpdateInput = {
      lastEventAt: new Date(event.occurredAt),
      startedAt: progress.startedAt ?? new Date(event.occurredAt),
      status:
        progress.status === LessonProgressStatus.COMPLETED
          ? LessonProgressStatus.COMPLETED
          : LessonProgressStatus.IN_PROGRESS,
    };

    switch (event.eventType) {
      case 'PAGE_VIEW':
      case 'RESUME_POSITION':
        if (typeof payload.currentPage === 'number') {
          data.currentPage = payload.currentPage;
        }
        if (typeof payload.totalPages === 'number') {
          data.totalPages = payload.totalPages;
        }
        if (Array.isArray(payload.visitedPages)) {
          data.visitedPages = payload.visitedPages as Prisma.InputJsonValue;
        } else if (typeof payload.currentPage === 'number') {
          const visited = new Set<number>(
            Array.isArray(progress.visitedPages)
              ? (progress.visitedPages as number[])
              : [],
          );
          visited.add(payload.currentPage);
          data.visitedPages = [...visited] as Prisma.InputJsonValue;
        }
        break;
      case 'SCROLL':
        if (typeof payload.scrollPercentage === 'number') {
          data.scrollPercentage = Math.min(
            100,
            Math.max(0, payload.scrollPercentage),
          );
        }
        break;
      case 'READING_TIME':
        if (typeof payload.deltaSeconds === 'number') {
          data.readingTimeSec =
            progress.readingTimeSec + Math.max(0, Math.floor(payload.deltaSeconds));
        }
        break;
      case 'VIDEO_PROGRESS':
      case 'VIDEO_SEEK':
      case 'VIDEO_PAUSE':
      case 'VIDEO_PLAY':
        if (typeof payload.currentTime === 'number') {
          data.resumePositionSec = payload.currentTime;
        }
        if (typeof payload.watchPercentage === 'number') {
          data.watchPercentage = Math.min(
            100,
            Math.max(0, payload.watchPercentage),
          );
        }
        if (typeof payload.playbackSpeed === 'number') {
          data.lastPlaybackSpeed = payload.playbackSpeed;
        }
        break;
      case 'VIDEO_SPEED':
        if (typeof payload.playbackSpeed === 'number') {
          data.lastPlaybackSpeed = payload.playbackSpeed;
        }
        break;
      case 'IDLE_END':
        if (typeof payload.deltaSeconds === 'number') {
          data.idleTimeSec =
            progress.idleTimeSec + Math.max(0, Math.floor(payload.deltaSeconds));
        }
        break;
      case 'LESSON_COMPLETED':
        // Client-emitted LESSON_COMPLETED is ignored for PDF (page timer engine owns it).
        break;
      default:
        break;
    }

    // Auto-complete heuristics (video only — PDF requires per-page timers)
    const nextWatch =
      typeof data.watchPercentage === 'number'
        ? data.watchPercentage
        : progress.watchPercentage;
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: event.lessonId },
    });

    if (
      progress.status !== LessonProgressStatus.COMPLETED &&
      lesson?.type === LessonType.VIDEO &&
      (nextWatch ?? 0) >= VIDEO_COMPLETION_PERCENT
    ) {
      data.status = LessonProgressStatus.COMPLETED;
      data.completedAt = new Date(event.occurredAt);
    }

    await this.prisma.lessonProgress.update({
      where: { id: progress.id },
      data,
    });

    const current = await this.prisma.courseAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });

    await this.prisma.courseAssignment.update({
      where: { id: assignmentId },
      data: {
        lastLessonId: event.lessonId,
        status: assignmentStatusBump(current.status),
        startedAt: current.startedAt ?? new Date(event.occurredAt),
      },
    });
  }

  private toPlayerAssessment(
    quiz:
      | {
          id: string;
          title: string | null;
          passingScore: number;
          maxAttempts: number;
          status: QuizStatus;
          questionCount: number;
          _count?: { questions: number };
        }
      | null
      | undefined,
    attempts: Array<{
      id: string;
      quizId: string;
      attemptNumber: number;
      score: number | null;
      passed: boolean | null;
      submittedAt: Date | null;
    }>,
    lessonCompleted: boolean,
    lessonLocked: boolean,
  ) {
    if (!quiz || quiz.status !== QuizStatus.PUBLISHED) return null;
    const mine = attempts.filter((row) => row.quizId === quiz.id);
    const submitted = mine.filter((row) => row.submittedAt);
    const passed = submitted.some((row) => row.passed);
    const last = submitted[0] ?? null;
    const remainingAttempts = Math.max(0, quiz.maxAttempts - mine.length);
    let state: 'locked' | 'ready' | 'passed' | 'failed' | 'exhausted' = 'ready';
    let lockReason: string | null = null;
    if (lessonLocked) {
      state = 'locked';
      lockReason = 'Complete the previous lesson first';
    } else if (!lessonCompleted) {
      state = 'locked';
      lockReason = 'Complete lesson first';
    } else if (passed) {
      state = 'passed';
    } else if (remainingAttempts <= 0) {
      state = 'exhausted';
      lockReason = 'Attempts exhausted';
    } else if (last && !last.passed) {
      state = 'failed';
    }
    return {
      id: quiz.id,
      title: quiz.title,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      questionCount: quiz._count?.questions ?? quiz.questionCount,
      state,
      lockReason,
      passed,
      lastScore: last?.score ?? null,
      attemptCount: mine.length,
      remainingAttempts,
      lastAttemptId: last?.id ?? null,
    };
  }

  async refreshAssignmentProgress(assignmentId: string) {
    return this.recalculateAssignmentProgress(assignmentId);
  }

  private async recalculateAssignmentProgress(assignmentId: string) {
    const assignment = await this.prisma.courseAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: {
        course: {
          include: {
            modules: {
              where: { deletedAt: null },
              include: {
                lessons: { where: { deletedAt: null } },
              },
            },
          },
        },
      },
    });

    const lessonIds = assignment.course.modules.flatMap((m) =>
      m.lessons
        .filter((l) => l.type !== LessonType.QUIZ)
        .map((l) => l.id),
    );
    const total = lessonIds.length || 1;
    const progressRows = await this.prisma.lessonProgress.findMany({
      where: { assignmentId, lessonId: { in: lessonIds } },
    });
    const completed = progressRows.filter(
      (p) => p.status === LessonProgressStatus.COMPLETED,
    ).length;
    const percent = Math.round((completed / total) * 100);

    const quizzes = await this.prisma.quiz.findMany({
      where: {
        lessonId: { in: lessonIds },
        deletedAt: null,
        status: QuizStatus.PUBLISHED,
      },
      select: { id: true },
    });
    const passedAttempts = quizzes.length
      ? await this.prisma.quizAttempt.findMany({
          where: {
            assignmentId,
            passed: true,
            quizId: { in: quizzes.map((quiz) => quiz.id) },
          },
          select: { quizId: true },
        })
      : [];
    const passedQuizIds = new Set(passedAttempts.map((row) => row.quizId));
    const assessmentsComplete = quizzes.every((quiz) => passedQuizIds.has(quiz.id));

    let status = assignment.status;
    if (percent >= 100 && assessmentsComplete) {
      status = AssignmentStatus.COMPLETED;
    } else if (completed > 0 || progressRows.some((p) => p.status !== LessonProgressStatus.NOT_STARTED)) {
      status = AssignmentStatus.IN_PROGRESS;
    }

    const updated = await this.prisma.courseAssignment.update({
      where: { id: assignmentId },
      data: {
        progressPercent: Math.min(100, percent),
        status,
        completedAt:
          status === AssignmentStatus.COMPLETED
            ? assignment.completedAt ?? new Date()
            : null,
        startedAt:
          status === AssignmentStatus.NOT_STARTED
            ? assignment.startedAt
            : assignment.startedAt ?? new Date(),
      },
    });
    const programEvent = await this.programProgress.syncForUserCourse(
      assignment.userId,
      assignment.courseId,
    );
    return { ...updated, programEvent };
  }

  private async upsertLessonProgress(
    assignmentId: string,
    lessonId: string,
    userId: string,
  ) {
    return this.prisma.lessonProgress.upsert({
      where: {
        assignmentId_lessonId: { assignmentId, lessonId },
      },
      create: {
        assignmentId,
        lessonId,
        userId,
        status: LessonProgressStatus.IN_PROGRESS,
        startedAt: new Date(),
        lastEventAt: new Date(),
      },
      update: {},
    });
  }

  private async resolveAssignScope(dto: AssignCourseDto): Promise<string[]> {
    const activeBase = {
      deletedAt: null as Date | null,
      status: UserStatus.ACTIVE,
    };

    if (dto.scope === AssignScope.ALL_EMPLOYEES) {
      const users = await this.prisma.user.findMany({
        where: { ...activeBase, role: AppRole.EMPLOYEE },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    if (dto.scope === AssignScope.DEPARTMENT) {
      if (!dto.departmentIds?.length) {
        throw new BadRequestException('Select at least one department');
      }
      const users = await this.prisma.user.findMany({
        where: {
          ...activeBase,
          role: AppRole.EMPLOYEE,
          departmentId: { in: dto.departmentIds },
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    if (dto.scope === AssignScope.ROLE) {
      if (!dto.roles?.length) {
        throw new BadRequestException('Select at least one role');
      }
      const users = await this.prisma.user.findMany({
        where: {
          ...activeBase,
          role: { in: dto.roles },
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    if (dto.scope === AssignScope.EMPLOYEES) {
      if (!dto.userIds?.length) {
        throw new BadRequestException('Select at least one employee');
      }
      const users = await this.prisma.user.findMany({
        where: {
          ...activeBase,
          id: { in: dto.userIds },
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    throw new BadRequestException('Invalid assignment scope');
  }

  private resolveDueAt(dto: AssignCourseDto): Date | null {
    if (dto.dueAt) {
      const parsed = new Date(dto.dueAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid due date');
      }
      return parsed;
    }
    if (dto.dueInDays) {
      return new Date(Date.now() + dto.dueInDays * 86_400_000);
    }
    return null;
  }

  private resolveDueInDays(dto: AssignCourseDto): number | null {
    if (dto.dueInDays && dto.dueInDays >= 1) return dto.dueInDays;
    if (dto.dueAt) {
      const parsed = new Date(dto.dueAt);
      const days = Math.ceil((parsed.getTime() - Date.now()) / 86_400_000);
      return days >= 1 ? days : null;
    }
    return null;
  }

  /**
   * Persists active rules so admins can re-sync (and new hires can be enrolled)
   * for All Employees / Department scopes when "Notify New Employees" is on.
   */
  private async ensureAutoEnrollRules(
    courseId: string,
    dto: AssignCourseDto,
    dueInDays: number | null,
  ): Promise<string[]> {
    const ruleIds: string[] = [];

    if (dto.scope === AssignScope.ALL_EMPLOYEES) {
      const existing = await this.prisma.courseAssignmentRule.findFirst({
        where: {
          courseId,
          targetType: AssignmentRuleTargetType.ALL_EMPLOYEES,
          deletedAt: null,
          isActive: true,
        },
      });
      if (existing) {
        await this.prisma.courseAssignmentRule.update({
          where: { id: existing.id },
          data: { dueInDays },
        });
        ruleIds.push(existing.id);
      } else {
        const created = await this.prisma.courseAssignmentRule.create({
          data: {
            courseId,
            targetType: AssignmentRuleTargetType.ALL_EMPLOYEES,
            dueInDays,
            isActive: true,
          },
        });
        ruleIds.push(created.id);
      }
      return ruleIds;
    }

    if (dto.scope === AssignScope.DEPARTMENT && dto.departmentIds?.length) {
      for (const departmentId of dto.departmentIds) {
        const existing = await this.prisma.courseAssignmentRule.findFirst({
          where: {
            courseId,
            targetType: AssignmentRuleTargetType.DEPARTMENT,
            departmentId,
            deletedAt: null,
            isActive: true,
          },
        });
        if (existing) {
          await this.prisma.courseAssignmentRule.update({
            where: { id: existing.id },
            data: { dueInDays },
          });
          ruleIds.push(existing.id);
        } else {
          const created = await this.prisma.courseAssignmentRule.create({
            data: {
              courseId,
              targetType: AssignmentRuleTargetType.DEPARTMENT,
              departmentId,
              dueInDays,
              isActive: true,
            },
          });
          ruleIds.push(created.id);
        }
      }
    }

    return ruleIds;
  }

  private async upsertAssignment(params: {
    courseId: string;
    userId: string;
    ruleId?: string | null;
    dueAt?: Date | null;
  }) {
    const existing = await this.prisma.courseAssignment.findUnique({
      where: {
        courseId_userId: {
          courseId: params.courseId,
          userId: params.userId,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      return { created: false, assignment: existing };
    }

    if (existing?.deletedAt) {
      const restored = await this.prisma.courseAssignment.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          ruleId: params.ruleId ?? existing.ruleId,
          dueAt: params.dueAt ?? existing.dueAt,
          status: AssignmentStatus.NOT_STARTED,
          progressPercent: 0,
        },
      });
      return { created: true, assignment: restored };
    }

    const assignment = await this.prisma.courseAssignment.create({
      data: {
        courseId: params.courseId,
        userId: params.userId,
        ruleId: params.ruleId ?? null,
        dueAt: params.dueAt ?? null,
      },
    });
    return { created: true, assignment };
  }

  private async resolveRuleUserIds(rule: {
    targetType: AssignmentRuleTargetType;
    departmentId: string | null;
    userId: string | null;
  }): Promise<string[]> {
    if (rule.targetType === AssignmentRuleTargetType.EMPLOYEE && rule.userId) {
      return [rule.userId];
    }
    if (
      rule.targetType === AssignmentRuleTargetType.DEPARTMENT &&
      rule.departmentId
    ) {
      const users = await this.prisma.user.findMany({
        where: {
          departmentId: rule.departmentId,
          deletedAt: null,
          status: UserStatus.ACTIVE,
          role: AppRole.EMPLOYEE,
        },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatus.ACTIVE,
        role: AppRole.EMPLOYEE,
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async requirePublishedCourse(courseId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
    });
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    if (course.status !== CourseStatus.PUBLISHED) {
      throw new BadRequestException('Only published courses can be assigned');
    }
    return course;
  }

  private async requireOwnedAssignment(
    assignmentId: string,
    user: AuthenticatedUser,
    options?: { allowAdminRead?: boolean },
  ) {
    const assignment = await this.prisma.courseAssignment.findFirst({
      where: { id: assignmentId, deletedAt: null },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    const isOwner = assignment.userId === user.userId;
    const isAdmin = user.roles.some(
      (role) => role === 'SUPER_ADMIN' || role === 'ADMIN',
    );

    if (!isOwner && !(options?.allowAdminRead && isAdmin)) {
      throw new ForbiddenException('You do not own this assignment');
    }
    if (isOwner) {
      await this.programProgress.assertCourseAccessible(assignment);
    }
    return assignment;
  }

  private async requireEnrollment(courseId: string, user: AuthenticatedUser) {
    const assignment = await this.prisma.courseAssignment.findFirst({
      where: { courseId, userId: user.userId, deletedAt: null },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not enrolled in this course');
    }
    await this.programProgress.assertCourseAccessible(assignment);
    return assignment;
  }

  private async requireEnrollmentForLesson(
    lessonId: string,
    user: AuthenticatedUser,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return this.requireEnrollment(lesson.module.courseId, user);
  }

  async assertLessonAccessible(
    assignmentId: string,
    courseId: string,
    lessonId: string,
  ) {
    await this.sequentialAccess.assertAccessible(assignmentId, courseId, lessonId);
  }

  private async ensureLessonBelongsToCourse(courseId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        module: { courseId, deletedAt: null },
      },
    });
    if (!lesson) {
      throw new BadRequestException('Lesson does not belong to this course');
    }
    return lesson;
  }

  private readPdfChapterBounds(quizConfig: Prisma.JsonValue | null): {
    pageStart: number;
    pageEnd: number;
  } | null {
    if (!quizConfig || typeof quizConfig !== 'object' || Array.isArray(quizConfig)) {
      return null;
    }
    const cfg = quizConfig as Record<string, unknown>;
    if (cfg['kind'] !== 'PDF_CHAPTER') return null;
    const pageStart = Number(cfg['pageStart']);
    const pageEnd = Number(cfg['pageEnd']);
    if (!Number.isFinite(pageStart) || !Number.isFinite(pageEnd) || pageStart < 1) {
      return null;
    }
    return { pageStart, pageEnd: Math.max(pageStart, pageEnd) };
  }
}

function assignmentStatusBump(status: AssignmentStatus): AssignmentStatus {
  if (status === AssignmentStatus.COMPLETED) {
    return AssignmentStatus.COMPLETED;
  }
  return AssignmentStatus.IN_PROGRESS;
}
