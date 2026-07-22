import { Injectable } from '@nestjs/common';
import {
  AppRole,
  AssignmentStatus,
  LessonType,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async adminDashboard() {
    const [
      users,
      courses,
      published,
      assignments,
      completed,
      overdue,
      quizAttempts,
      avgReading,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.course.count({ where: { deletedAt: null } }),
      this.prisma.course.count({
        where: { deletedAt: null, status: 'PUBLISHED' },
      }),
      this.prisma.courseAssignment.count({ where: { deletedAt: null } }),
      this.prisma.courseAssignment.count({
        where: { deletedAt: null, status: AssignmentStatus.COMPLETED },
      }),
      this.prisma.courseAssignment.count({
        where: {
          deletedAt: null,
          status: { not: AssignmentStatus.COMPLETED },
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.quizAttempt.count({ where: { submittedAt: { not: null } } }),
      this.prisma.lessonProgress.aggregate({ _avg: { readingTimeSec: true } }),
      this.prisma.notification.count({ where: { readAt: null } }),
    ]);

    return {
      users,
      courses,
      publishedCourses: published,
      assignments,
      completedAssignments: completed,
      overdueAssignments: overdue,
      completionRate:
        assignments === 0 ? 0 : Math.round((completed / assignments) * 100),
      quizAttempts,
      avgReadingMinutes: Math.round((avgReading._avg.readingTimeSec ?? 0) / 60),
      unreadNotifications,
    };
  }

  async managerDashboard(user: AuthenticatedUser) {
    const reportees = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { managerId: user.userId },
          {
            departmentId: {
              in: (
                await this.prisma.user.findUnique({
                  where: { id: user.userId },
                  select: { departmentId: true },
                })
              )?.departmentId
                ? [
                    (
                      await this.prisma.user.findUnique({
                        where: { id: user.userId },
                        select: { departmentId: true },
                      })
                    )!.departmentId!,
                  ]
                : [],
            },
            role: AppRole.EMPLOYEE,
          },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const ids = reportees.map((r) => r.id);
    const assignments = await this.prisma.courseAssignment.findMany({
      where: { userId: { in: ids }, deletedAt: null },
      include: {
        course: { select: { id: true, title: true, code: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return {
      teamSize: reportees.length,
      openAssignments: assignments.filter(
        (a) => a.status !== AssignmentStatus.COMPLETED,
      ).length,
      completedAssignments: assignments.filter(
        (a) => a.status === AssignmentStatus.COMPLETED,
      ).length,
      overdue: assignments.filter(
        (a) =>
          a.status !== AssignmentStatus.COMPLETED &&
          a.dueAt &&
          a.dueAt < new Date(),
      ).length,
      assignments: assignments.map((a) => ({
        ...a,
        isOverdue:
          a.status !== AssignmentStatus.COMPLETED &&
          !!a.dueAt &&
          a.dueAt < new Date(),
      })),
    };
  }

  async courseCompletion() {
    const courses = await this.prisma.course.findMany({
      where: { deletedAt: null, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        code: true,
        assignments: {
          where: { deletedAt: null },
          select: { status: true },
        },
      },
      orderBy: { title: 'asc' },
    });

    return courses.map((c) => {
      const total = c.assignments.length;
      const completed = c.assignments.filter(
        (a) => a.status === AssignmentStatus.COMPLETED,
      ).length;
      return {
        courseId: c.id,
        title: c.title,
        code: c.code,
        assigned: total,
        completed,
        completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
      };
    });
  }

  async employeeProgress(managerScopedUserIds?: string[]) {
    const where: Prisma.CourseAssignmentWhereInput = {
      deletedAt: null,
      ...(managerScopedUserIds
        ? { userId: { in: managerScopedUserIds } }
        : {}),
    };

    const rows = await this.prisma.courseAssignment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: { select: { name: true } },
          },
        },
        course: { select: { title: true, code: true } },
      },
      orderBy: [{ progressPercent: 'asc' }, { dueAt: 'asc' }],
      take: 200,
    });

    return rows;
  }

  async readingTimeAnalytics() {
    const grouped = await this.prisma.lessonProgress.groupBy({
      by: ['lessonId'],
      _sum: { readingTimeSec: true, idleTimeSec: true },
      _avg: { scrollPercentage: true },
      _count: true,
    });

    const lessons = await this.prisma.lesson.findMany({
      where: {
        id: { in: grouped.map((g) => g.lessonId) },
        type: LessonType.PDF,
      },
      select: { id: true, title: true, type: true },
    });
    const map = new Map(lessons.map((l) => [l.id, l]));

    return grouped
      .filter((g) => map.has(g.lessonId))
      .map((g) => ({
        lessonId: g.lessonId,
        title: map.get(g.lessonId)!.title,
        learners: g._count,
        totalReadingMinutes: Math.round((g._sum.readingTimeSec ?? 0) / 60),
        totalIdleMinutes: Math.round((g._sum.idleTimeSec ?? 0) / 60),
        avgScrollPercentage: Math.round(g._avg.scrollPercentage ?? 0),
      }));
  }

  async videoAnalytics() {
    const grouped = await this.prisma.lessonProgress.groupBy({
      by: ['lessonId'],
      _avg: { watchPercentage: true, lastPlaybackSpeed: true },
      _sum: { readingTimeSec: true },
      _count: true,
    });

    const lessons = await this.prisma.lesson.findMany({
      where: {
        id: { in: grouped.map((g) => g.lessonId) },
        type: LessonType.VIDEO,
      },
      select: { id: true, title: true },
    });
    const map = new Map(lessons.map((l) => [l.id, l]));

    return grouped
      .filter((g) => map.has(g.lessonId))
      .map((g) => ({
        lessonId: g.lessonId,
        title: map.get(g.lessonId)!.title,
        learners: g._count,
        avgWatchPercentage: Math.round(g._avg.watchPercentage ?? 0),
        avgPlaybackSpeed: Number((g._avg.lastPlaybackSpeed ?? 1).toFixed(2)),
      }));
  }

  async quizAnalytics() {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { submittedAt: { not: null } },
      include: {
        quiz: {
          include: {
            lesson: { select: { id: true, title: true } },
          },
        },
      },
    });

    const byQuiz = new Map<
      string,
      {
        lessonTitle: string;
        attempts: number;
        passed: number;
        scoreSum: number;
      }
    >();

    for (const attempt of attempts) {
      const key = attempt.quizId;
      const entry = byQuiz.get(key) ?? {
        lessonTitle: attempt.quiz.lesson.title,
        attempts: 0,
        passed: 0,
        scoreSum: 0,
      };
      entry.attempts += 1;
      if (attempt.passed) entry.passed += 1;
      entry.scoreSum += attempt.score ?? 0;
      byQuiz.set(key, entry);
    }

    return [...byQuiz.entries()].map(([quizId, v]) => ({
      quizId,
      lessonTitle: v.lessonTitle,
      attempts: v.attempts,
      passRate: Math.round((v.passed / v.attempts) * 100),
      avgScore: Math.round(v.scoreSum / v.attempts),
    }));
  }

  async auditLogs(params: {
    page: number;
    pageSize: number;
    action?: string;
  }) {
    const where = {
      ...(params.action ? { action: params.action } : {}),
    };
    const [totalItems, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
    ]);

    return {
      items,
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / params.pageSize)),
      },
    };
  }
}
