import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssignmentStatus,
  LevelProgressStatus,
  ProgramEnrollmentStatus,
  QuizStatus,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import {
  isFinalLevelComplete,
  isLevelUnlocked,
  requiredCoursesComplete,
} from './program-rules';

export type SyncResult = {
  newlyCompletedLevelId: string | null;
  newlyCompletedLevelTitle: string | null;
  nextLevelTitle: string | null;
  programJustCompleted: boolean;
};

@Injectable()
export class ProgramProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async assertCourseAccessible(assignment: {
    courseId: string;
    userId: string;
    programEnrollmentId: string | null;
  }) {
    if (!assignment.programEnrollmentId) return;
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { id: assignment.programEnrollmentId, deletedAt: null },
    });
    if (!enrollment || enrollment.userId !== assignment.userId) {
      throw new ForbiddenException('Program enrollment not found.');
    }
    const view = await this.evaluate(enrollment.id);
    const level = view.levels.find((item) =>
      item.courses.some((course) => course.courseId === assignment.courseId),
    );
    if (!level) return;
    if (level.locked) {
      throw new ForbiddenException(
        'Complete the previous program level before opening this course.',
      );
    }
  }

  async assertFinalAssessmentAccessible(enrollmentId: string | null, userId: string) {
    if (!enrollmentId) {
      throw new ForbiddenException('Final assessment is not available.');
    }
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { id: enrollmentId, userId, deletedAt: null },
    });
    if (!enrollment) {
      throw new ForbiddenException('Program enrollment not found.');
    }
    const view = await this.evaluate(enrollmentId);
    const finalLevel = view.levels.find((level) => level.isFinal);
    if (!finalLevel?.finalAssessment) {
      throw new ForbiddenException('Final assessment is not configured.');
    }
    if (finalLevel.locked) {
      throw new ForbiddenException('Complete previous levels before the final assessment.');
    }
    if (finalLevel.finalAssessment.locked) {
      throw new ForbiddenException(
        'Complete all required courses in the final level before the assessment.',
      );
    }
  }

  async syncForUserCourse(userId: string, courseId: string): Promise<SyncResult | null> {
    const links = await this.prisma.levelCourse.findMany({
      where: { courseId },
      select: { level: { select: { programId: true } } },
    });
    const programIds = [...new Set(links.map((row) => row.level.programId))];
    if (programIds.length === 0) return null;

    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { userId, programId: { in: programIds }, deletedAt: null },
    });
    let last: SyncResult | null = null;
    for (const enrollment of enrollments) {
      last = await this.syncEnrollment(enrollment.id);
    }
    return last;
  }

  async syncEnrollment(enrollmentId: string): Promise<SyncResult> {
    const before = await this.prisma.levelProgress.findMany({
      where: { enrollmentId, status: LevelProgressStatus.COMPLETED },
      select: { levelId: true },
    });
    const beforeIds = new Set(before.map((row) => row.levelId));
    const view = await this.evaluate(enrollmentId);

    let newlyCompletedLevelId: string | null = null;
    let newlyCompletedLevelTitle: string | null = null;
    let nextLevelTitle: string | null = null;

    for (const [index, level] of view.levels.entries()) {
      if (level.completed && !beforeIds.has(level.id)) {
        newlyCompletedLevelId = level.id;
        newlyCompletedLevelTitle = level.title;
        nextLevelTitle = view.levels[index + 1]?.title ?? null;
      }
    }

    const enrollment = await this.prisma.programEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { program: true, user: true, certificate: true },
    });

    const allComplete = view.levels.length > 0 && view.levels.every((level) => level.completed);
    const programJustCompleted =
      allComplete && enrollment.status !== ProgramEnrollmentStatus.COMPLETED;

    const current = view.levels.find((level) => !level.locked && !level.completed) ?? view.levels.at(-1);

    await this.prisma.programEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: allComplete
          ? ProgramEnrollmentStatus.COMPLETED
          : view.levels.some((level) => level.completed || level.available)
            ? ProgramEnrollmentStatus.IN_PROGRESS
            : ProgramEnrollmentStatus.NOT_STARTED,
        currentLevelId: current?.id ?? null,
        startedAt: enrollment.startedAt ?? new Date(),
        completedAt: allComplete ? enrollment.completedAt ?? new Date() : null,
      },
    });

    if (programJustCompleted && !enrollment.certificate) {
      await this.issueCertificate(enrollmentId);
    }

    return {
      newlyCompletedLevelId,
      newlyCompletedLevelTitle,
      nextLevelTitle,
      programJustCompleted,
    };
  }

  async evaluate(enrollmentId: string) {
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { id: enrollmentId, deletedAt: null },
      include: {
        program: {
          include: {
            levels: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
              include: {
                courses: { orderBy: { sortOrder: 'asc' }, include: { course: true } },
                finalAssessment: {
                  where: { deletedAt: null },
                  select: { id: true, status: true, title: true, passingScore: true, maxAttempts: true, questionCount: true },
                },
              },
            },
          },
        },
        user: true,
        certificate: true,
      },
    });
    if (!enrollment) throw new NotFoundException('Program enrollment not found');

    const courseIds = enrollment.program.levels.flatMap((level) =>
      level.courses.map((item) => item.courseId),
    );
    const assignments = await this.prisma.courseAssignment.findMany({
      where: { userId: enrollment.userId, courseId: { in: courseIds }, deletedAt: null },
    });
    const completedCourseIds = new Set(
      assignments
        .filter((row) => row.status === AssignmentStatus.COMPLETED)
        .map((row) => row.courseId),
    );

    const quizIds = enrollment.program.levels
      .map((level) => level.finalAssessment?.id)
      .filter((id): id is string => !!id);
    const passedAttempts = quizIds.length
      ? await this.prisma.quizAttempt.findMany({
          where: { quizId: { in: quizIds }, userId: enrollment.userId, passed: true },
          select: { quizId: true },
        })
      : [];
    const passedQuizIds = new Set(passedAttempts.map((row) => row.quizId));

    let previousCompleted = true;
    const levels = [];
    for (const [index, level] of enrollment.program.levels.entries()) {
      const unlocked = isLevelUnlocked(index, previousCompleted);
      const requiredIds = level.courses.filter((c) => c.isRequired).map((c) => c.courseId);
      const coursesDone = requiredCoursesComplete(requiredIds, completedCourseIds);
      const hasFinal =
        !!level.finalAssessment && level.finalAssessment.status === QuizStatus.PUBLISHED;
      const finalPassed = hasFinal && passedQuizIds.has(level.finalAssessment!.id);
      const completed = level.isFinal
        ? isFinalLevelComplete({
            requiredCourseIds: requiredIds,
            completedCourseIds,
            hasFinalAssessment: hasFinal,
            finalAssessmentPassed: finalPassed,
          })
        : coursesDone;
      const available = unlocked && !completed;
      const locked = !unlocked;
      previousCompleted = completed;

      await this.prisma.levelProgress.upsert({
        where: { enrollmentId_levelId: { enrollmentId, levelId: level.id } },
        create: {
          enrollmentId,
          levelId: level.id,
          status: completed
            ? LevelProgressStatus.COMPLETED
            : available
              ? LevelProgressStatus.AVAILABLE
              : LevelProgressStatus.LOCKED,
          completedAt: completed ? new Date() : null,
        },
        update: {
          status: completed
            ? LevelProgressStatus.COMPLETED
            : available
              ? LevelProgressStatus.AVAILABLE
              : LevelProgressStatus.LOCKED,
          completedAt: completed ? new Date() : null,
        },
      });

      levels.push({
        id: level.id,
        title: level.title,
        description: level.description,
        sortOrder: level.sortOrder,
        number: index + 1,
        isFinal: level.isFinal,
        locked,
        available,
        completed,
        requiredCount: requiredIds.length,
        completedRequiredCount: requiredIds.filter((id) => completedCourseIds.has(id)).length,
        courses: level.courses.map((item) => {
          const assignment = assignments.find((row) => row.courseId === item.courseId);
          return {
            id: item.id,
            courseId: item.courseId,
            title: item.course.title,
            code: item.course.code,
            description: item.course.description,
            isRequired: item.isRequired,
            sortOrder: item.sortOrder,
            assignmentId: assignment?.id ?? null,
            status: assignment?.status ?? 'NOT_STARTED',
            progressPercent: assignment?.progressPercent ?? 0,
            completed: assignment?.status === AssignmentStatus.COMPLETED,
          };
        }),
        courseCount: level.courses.length,
        completedCourseCount: level.courses.filter(
          (item) =>
            assignments.find((row) => row.courseId === item.courseId)?.status ===
            AssignmentStatus.COMPLETED,
        ).length,
        finalAssessment:
          level.isFinal && hasFinal
            ? {
                id: level.finalAssessment!.id,
                title: level.finalAssessment!.title,
                passingScore: level.finalAssessment!.passingScore,
                maxAttempts: level.finalAssessment!.maxAttempts,
                questionCount: level.finalAssessment!.questionCount,
                passed: finalPassed,
                available: unlocked && coursesDone && !finalPassed,
                locked: locked || !coursesDone,
              }
            : null,
      });
    }

    const completedCourses = [...completedCourseIds].filter((id) => courseIds.includes(id)).length;
    return {
      enrollmentId: enrollment.id,
      programId: enrollment.programId,
      programName: enrollment.program.name,
      programDescription: enrollment.program.description,
      status: enrollment.status,
      levels,
      totalCourses: courseIds.length,
      completedCourses,
      progressPercent: courseIds.length
        ? Math.round((completedCourses / courseIds.length) * 100)
        : 0,
      certificate: enrollment.certificate,
      programCompleted: levels.length > 0 && levels.every((level) => level.completed),
    };
  }

  async getCertificateOrThrow(enrollmentId: string, userId: string) {
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { id: enrollmentId, userId, deletedAt: null },
      include: { certificate: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.status !== ProgramEnrollmentStatus.COMPLETED || !enrollment.certificate) {
      throw new ForbiddenException('Certificate is available only after program completion.');
    }
    return enrollment.certificate;
  }

  private async issueCertificate(enrollmentId: string) {
    const enrollment = await this.prisma.programEnrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { user: true, program: true },
    });
    const code = `ZBL-${randomBytes(4).toString('hex').toUpperCase()}`;
    const cert = await this.prisma.programCertificate.create({
      data: {
        enrollmentId,
        certificateCode: code,
        employeeName: `${enrollment.user.firstName} ${enrollment.user.lastName}`.trim(),
        programName: enrollment.program.name,
        organizationName: process.env.ORGANIZATION_NAME || 'Zebl',
      },
    });
    await this.audit.write({
      actorId: enrollment.userId,
      action: AuditActions.CERTIFICATE_ISSUED,
      entityType: 'ProgramCertificate',
      entityId: cert.id,
      metadata: { programId: enrollment.programId, enrollmentId },
    });
    return cert;
  }
}
