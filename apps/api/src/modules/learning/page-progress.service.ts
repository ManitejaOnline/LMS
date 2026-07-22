import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LessonProgressStatus,
  LessonType,
  type PageProgress,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  PDF_PAGE_HEARTBEAT_MAX_SECONDS,
  PDF_PAGE_HEARTBEAT_MIN_INTERVAL_MS,
  PDF_PAGE_REQUIRED_SECONDS,
} from './learning.constants';
import type { CompletePageDto, SavePageProgressDto } from './dto/page-progress.dto';

@Injectable()
export class PageProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async listPageProgress(
    assignmentId: string,
    lessonId: string,
    user: AuthenticatedUser,
  ) {
    await this.requireOwnedAssignment(assignmentId, user);
    await this.requirePdfLesson(lessonId);

    const pages = await this.prisma.pageProgress.findMany({
      where: { assignmentId, lessonId, userId: user.userId },
      orderBy: { pageNumber: 'asc' },
    });

    return {
      requiredSecondsPerPage: PDF_PAGE_REQUIRED_SECONDS,
      pages: pages.map((p) => this.toDto(p)),
    };
  }

  async saveHeartbeat(
    assignmentId: string,
    lessonId: string,
    dto: SavePageProgressDto,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.requireOwnedAssignment(assignmentId, user);
    const lesson = await this.requirePdfLesson(lessonId);
    await this.ensureLessonInCourse(assignment.courseId, lessonId);

    const pageNumber = dto.pageNumber;
    const now = new Date();
    const bounds = this.readChapterBounds(lesson.quizConfig);
    const pageStart = bounds?.pageStart ?? 1;

    // Sequence lock: cannot credit time on page N until prior pages are complete
    if (pageNumber > pageStart) {
      await this.assertCanOpenPageForward(
        assignmentId,
        lessonId,
        user.userId,
        pageNumber,
        pageStart,
      );
    }

    let row = await this.prisma.pageProgress.findUnique({
      where: {
        assignmentId_lessonId_pageNumber: {
          assignmentId,
          lessonId,
          pageNumber,
        },
      },
    });

    if (!row) {
      row = await this.prisma.pageProgress.create({
        data: {
          assignmentId,
          lessonId,
          userId: user.userId,
          pageNumber,
          requiredSeconds: PDF_PAGE_REQUIRED_SECONDS,
          startedAt: now,
          lastHeartbeatAt: now,
        },
      });
      await this.writeEvent(assignmentId, lessonId, user.userId, 'PAGE_STARTED', {
        pageNumber,
      });
    }

    if (row.completed) {
      return this.toDto(row);
    }

    // Rate-limit credited time
    let credit = Math.max(0, Math.min(dto.deltaSeconds, PDF_PAGE_HEARTBEAT_MAX_SECONDS));
    if (row.lastHeartbeatAt) {
      const elapsedMs = now.getTime() - row.lastHeartbeatAt.getTime();
      if (elapsedMs < PDF_PAGE_HEARTBEAT_MIN_INTERVAL_MS) {
        credit = 0;
      } else {
        const maxByWall = Math.floor(elapsedMs / 1000) + 1;
        credit = Math.min(credit, maxByWall);
      }
    }

    const nextSeconds = Math.min(
      row.requiredSeconds,
      row.completedSeconds + credit,
    );
    const justCompleted = nextSeconds >= row.requiredSeconds;

    const updated = await this.prisma.pageProgress.update({
      where: { id: row.id },
      data: {
        completedSeconds: nextSeconds,
        pauseCount: { increment: dto.pauseCountDelta ?? 0 },
        totalPausedSec: { increment: dto.pausedSecondsDelta ?? 0 },
        focusLostCount: { increment: dto.focusLostDelta ?? 0 },
        tabSwitchCount: { increment: dto.tabSwitchDelta ?? 0 },
        hiddenCount: { increment: dto.hiddenDelta ?? 0 },
        idleCount: { increment: dto.idleDelta ?? 0 },
        lastHeartbeatAt: now,
        startedAt: row.startedAt ?? now,
        ...(justCompleted
          ? { completed: true, completedAt: now }
          : {}),
      },
    });

    await this.syncLessonProgress(assignmentId, lessonId, user.userId, {
      currentPage: pageNumber,
      totalPages: dto.totalPages,
      readingDelta: credit,
    });

    if (justCompleted && !row.completed) {
      await this.writeEvent(assignmentId, lessonId, user.userId, 'PAGE_COMPLETED', {
        pageNumber,
        completedSeconds: updated.completedSeconds,
        requiredSeconds: updated.requiredSeconds,
      });
      await this.tryCompletePdfLesson(assignmentId, lessonId, user.userId, lesson);
    }

    return this.toDto(updated);
  }

  async completePage(
    assignmentId: string,
    lessonId: string,
    dto: CompletePageDto,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.requireOwnedAssignment(assignmentId, user);
    const lesson = await this.requirePdfLesson(lessonId);
    await this.ensureLessonInCourse(assignment.courseId, lessonId);

    const pageNumber = dto.pageNumber;
    if (!pageNumber || pageNumber < 1) {
      throw new BadRequestException('pageNumber is required');
    }

    const row = await this.prisma.pageProgress.findUnique({
      where: {
        assignmentId_lessonId_pageNumber: {
          assignmentId,
          lessonId,
          pageNumber,
        },
      },
    });

    if (!row) {
      throw new BadRequestException(
        'Page progress not found. Spend the required reading time first.',
      );
    }

    if (row.completedSeconds < row.requiredSeconds) {
      throw new ForbiddenException(
        `Page ${pageNumber} requires ${row.requiredSeconds}s of active reading (have ${row.completedSeconds}s)`,
      );
    }

    const updated = row.completed
      ? row
      : await this.prisma.pageProgress.update({
          where: { id: row.id },
          data: { completed: true, completedAt: new Date() },
        });

    if (!row.completed) {
      await this.writeEvent(assignmentId, lessonId, user.userId, 'PAGE_COMPLETED', {
        pageNumber,
      });
    }

    await this.tryCompletePdfLesson(assignmentId, lessonId, user.userId, lesson);
    return this.toDto(updated);
  }

  /**
   * Returns whether the learner may navigate forward TO targetPage
   * (must have completed all pages strictly before it within [pageStart, pageEnd]).
   */
  async assertCanOpenPageForward(
    assignmentId: string,
    lessonId: string,
    userId: string,
    targetPage: number,
    pageStart: number,
  ) {
    if (targetPage <= pageStart) return;
    const prior = await this.prisma.pageProgress.findMany({
      where: {
        assignmentId,
        lessonId,
        userId,
        pageNumber: { gte: pageStart, lt: targetPage },
      },
    });
    const byPage = new Map(prior.map((p) => [p.pageNumber, p]));
    for (let p = pageStart; p < targetPage; p += 1) {
      const row = byPage.get(p);
      if (!row?.completed) {
        throw new ForbiddenException(
          `Complete page ${p} before continuing to page ${targetPage}`,
        );
      }
    }
  }

  async ensureAllPagesCompleteForLesson(
    assignmentId: string,
    lessonId: string,
    userId: string,
    pageStart: number,
    pageEnd: number,
  ) {
    const pages = await this.prisma.pageProgress.findMany({
      where: {
        assignmentId,
        lessonId,
        userId,
        pageNumber: { gte: pageStart, lte: pageEnd },
      },
    });
    const byPage = new Map(pages.map((p) => [p.pageNumber, p]));
    const missing: number[] = [];
    for (let p = pageStart; p <= pageEnd; p += 1) {
      const row = byPage.get(p);
      if (!row?.completed || row.completedSeconds < row.requiredSeconds) {
        missing.push(p);
      }
    }
    if (missing.length) {
      throw new ForbiddenException(
        `PDF lesson incomplete. Unfinished pages: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`,
      );
    }
  }

  private async tryCompletePdfLesson(
    assignmentId: string,
    lessonId: string,
    userId: string,
    lesson: { id: string; quizConfig: Prisma.JsonValue | null },
  ) {
    const bounds = this.readChapterBounds(lesson.quizConfig);
    const lessonProgress = await this.prisma.lessonProgress.findUnique({
      where: { assignmentId_lessonId: { assignmentId, lessonId } },
    });
    const pageStart = bounds?.pageStart ?? 1;
    const pageEnd = bounds?.pageEnd ?? lessonProgress?.totalPages ?? null;
    if (!pageEnd || pageEnd < pageStart) return;

    const pages = await this.prisma.pageProgress.findMany({
      where: {
        assignmentId,
        lessonId,
        userId,
        pageNumber: { gte: pageStart, lte: pageEnd },
      },
    });
    const byPage = new Map(pages.map((p) => [p.pageNumber, p]));
    for (let p = pageStart; p <= pageEnd; p += 1) {
      const row = byPage.get(p);
      if (!row?.completed || row.completedSeconds < row.requiredSeconds) return;
    }

    await this.prisma.lessonProgress.updateMany({
      where: { assignmentId, lessonId, userId },
      data: {
        status: LessonProgressStatus.COMPLETED,
        completedAt: new Date(),
        scrollPercentage: 100,
        lastEventAt: new Date(),
      },
    });

    await this.writeEvent(assignmentId, lessonId, userId, 'LESSON_COMPLETED', {
      source: 'page_progress_engine',
      pageStart,
      pageEnd,
    });
  }

  private readChapterBounds(quizConfig: Prisma.JsonValue | null): {
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

  private async syncLessonProgress(
    assignmentId: string,
    lessonId: string,
    userId: string,
    opts: { currentPage: number; totalPages?: number; readingDelta: number },
  ) {
    const existing = await this.prisma.lessonProgress.findUnique({
      where: { assignmentId_lessonId: { assignmentId, lessonId } },
    });

    const visited = new Set<number>(
      Array.isArray(existing?.visitedPages)
        ? (existing!.visitedPages as number[])
        : [],
    );
    visited.add(opts.currentPage);

    await this.prisma.lessonProgress.upsert({
      where: { assignmentId_lessonId: { assignmentId, lessonId } },
      create: {
        assignmentId,
        lessonId,
        userId,
        status: LessonProgressStatus.IN_PROGRESS,
        currentPage: opts.currentPage,
        totalPages: opts.totalPages ?? null,
        visitedPages: [...visited],
        readingTimeSec: opts.readingDelta,
        startedAt: new Date(),
        lastEventAt: new Date(),
      },
      update: {
        status:
          existing?.status === LessonProgressStatus.COMPLETED
            ? LessonProgressStatus.COMPLETED
            : LessonProgressStatus.IN_PROGRESS,
        currentPage: opts.currentPage,
        totalPages: opts.totalPages ?? existing?.totalPages ?? null,
        visitedPages: [...visited],
        readingTimeSec: { increment: opts.readingDelta },
        lastEventAt: new Date(),
        startedAt: existing?.startedAt ?? new Date(),
      },
    });

    await this.prisma.courseAssignment.update({
      where: { id: assignmentId },
      data: {
        lastLessonId: lessonId,
        startedAt: existing ? undefined : new Date(),
        status: 'IN_PROGRESS',
      },
    });
  }

  private toDto(p: PageProgress) {
    return {
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
    };
  }

  private async writeEvent(
    assignmentId: string,
    lessonId: string,
    userId: string,
    eventType:
      | 'PAGE_STARTED'
      | 'PAGE_COMPLETED'
      | 'PAGE_PAUSED'
      | 'PAGE_RESUMED'
      | 'LESSON_COMPLETED',
    payload: Record<string, unknown>,
  ) {
    await this.prisma.learningEvent.create({
      data: {
        assignmentId,
        lessonId,
        userId,
        eventType,
        occurredAt: new Date(),
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private async requireOwnedAssignment(
    assignmentId: string,
    user: AuthenticatedUser,
  ) {
    const assignment = await this.prisma.courseAssignment.findFirst({
      where: { id: assignmentId, deletedAt: null },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.userId !== user.userId) {
      const isAdmin = user.roles.some(
        (r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'MANAGER',
      );
      if (!isAdmin) throw new ForbiddenException('Not your assignment');
    }
    return assignment;
  }

  private async requirePdfLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.type !== LessonType.PDF) {
      throw new BadRequestException('Page progress applies only to PDF lessons');
    }
    return lesson;
  }

  private async ensureLessonInCourse(courseId: string, lessonId: string) {
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
  }
}
