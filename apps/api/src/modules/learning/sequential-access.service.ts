import { ForbiddenException, Injectable } from '@nestjs/common';
import { LessonProgressStatus, LessonType, QuizStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  isLessonSequentiallyLocked,
  type SequenceLesson,
} from './sequential-lessons.util';

export type SequenceState = {
  lessons: SequenceLesson[];
  completedIds: Set<string>;
  passedAssessmentIds: Set<string>;
};

@Injectable()
export class SequentialAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async loadSequenceState(
    assignmentId: string,
    courseId: string,
  ): Promise<SequenceState> {
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        lessons: {
          where: { deletedAt: null, type: { not: LessonType.QUIZ } },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            quiz: {
              select: { id: true, status: true, deletedAt: true },
            },
          },
        },
      },
    });

    const lessons: SequenceLesson[] = modules.flatMap((mod) =>
      mod.lessons.map((lesson) => ({
        id: lesson.id,
        hasAssessment:
          !!lesson.quiz &&
          !lesson.quiz.deletedAt &&
          lesson.quiz.status === QuizStatus.PUBLISHED,
      })),
    );

    const lessonIds = lessons.map((lesson) => lesson.id);
    const progress = await this.prisma.lessonProgress.findMany({
      where: { assignmentId, lessonId: { in: lessonIds } },
      select: { lessonId: true, status: true },
    });
    const completedIds = new Set(
      progress
        .filter((row) => row.status === LessonProgressStatus.COMPLETED)
        .map((row) => row.lessonId),
    );

    const passedAttempts = await this.prisma.quizAttempt.findMany({
      where: {
        assignmentId,
        passed: true,
        quiz: { deletedAt: null, status: QuizStatus.PUBLISHED },
      },
      select: { quiz: { select: { lessonId: true } } },
    });
    const passedAssessmentIds = new Set(
      passedAttempts
        .map((row) => row.quiz.lessonId)
        .filter((id): id is string => !!id),
    );

    return { lessons, completedIds, passedAssessmentIds };
  }

  async assertAccessible(
    assignmentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    const state = await this.loadSequenceState(assignmentId, courseId);
    if (
      isLessonSequentiallyLocked(
        state.lessons,
        lessonId,
        state.completedIds,
        state.passedAssessmentIds,
      )
    ) {
      throw new ForbiddenException(
        'Complete the previous lesson and its assessment before opening this one.',
      );
    }
  }

  async assertAssessmentAccessible(
    assignmentId: string,
    courseId: string,
    lessonId: string,
  ): Promise<void> {
    await this.assertAccessible(assignmentId, courseId, lessonId);
    const state = await this.loadSequenceState(assignmentId, courseId);
    if (!state.completedIds.has(lessonId)) {
      throw new ForbiddenException(
        'Complete the lesson before starting its assessment.',
      );
    }
    const lesson = state.lessons.find((item) => item.id === lessonId);
    if (!lesson?.hasAssessment) {
      throw new ForbiddenException('No published assessment for this lesson.');
    }
  }
}
