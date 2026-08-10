import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LessonProgressStatus,
  LessonType,
  Prisma,
  QuizStatus,
} from '@prisma/client';
import { ReorderDto } from '../courses/dto/reorder.dto';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SequentialAccessService } from '../learning/sequential-access.service';
import { LearningService } from '../learning/learning.service';
import { ProgramProgressService } from '../programs/program-progress.service';
import {
  isAssessmentPassing,
  scorePercent,
  validateAssessmentPublish,
  validateMcqQuestion,
} from './assessment-rules';
import {
  CreateAssessmentDto,
  QuizQuestionInputDto,
  SubmitQuizDto,
  UpdateAssessmentDto,
  UpsertQuizDto,
} from './dto/quiz.dto';

type ClientMeta = { ipAddress?: string; userAgent?: string };

const adminQuizInclude = {
  questions: {
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' as const },
    include: { options: { orderBy: { sortOrder: 'asc' as const } } },
  },
} satisfies Prisma.QuizInclude;

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sequentialAccess: SequentialAccessService,
    private readonly learning: LearningService,
    private readonly programProgress: ProgramProgressService,
  ) {}

  async createForLesson(
    lessonId: string,
    dto: CreateAssessmentDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const lesson = await this.requirePdfOrVideoLesson(lessonId);
    const existing = await this.prisma.quiz.findFirst({
      where: { lessonId, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('This lesson already has an assessment.');
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        lessonId: lesson.id,
        title: dto.title?.trim() || 'Assessment',
        passingScore: dto.passingScore ?? 80,
        maxAttempts: dto.maxAttempts ?? 3,
        showCorrectAnswers: dto.showCorrectAnswers ?? false,
        shuffleQuestions: false,
        questionCount: 0,
        status: QuizStatus.DRAFT,
      },
      include: adminQuizInclude,
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSESSMENT_CREATED,
      entityType: 'Assessment',
      entityId: quiz.id,
      metadata: { lessonId },
      ...meta,
    });
    return quiz;
  }

  async upsertForLesson(
    lessonId: string,
    dto: UpsertQuizDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requirePdfOrVideoLesson(lessonId);
    this.assertQuestionsValid(dto.questions);
    if (dto.status === QuizStatus.PUBLISHED) {
      this.assertPublishable({
        title: dto.title,
        passingScore: dto.passingScore ?? 80,
        maxAttempts: dto.maxAttempts ?? 3,
        questions: dto.questions,
      });
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quiz.findUnique({ where: { lessonId } });
      const saved = existing
        ? await tx.quiz.update({
            where: { id: existing.id },
            data: {
              title: dto.title?.trim() || existing.title,
              passingScore: dto.passingScore ?? existing.passingScore,
              questionCount: dto.questions.length,
              maxAttempts: dto.maxAttempts ?? existing.maxAttempts,
              shuffleQuestions: dto.shuffleQuestions ?? false,
              showCorrectAnswers:
                dto.showCorrectAnswers ?? existing.showCorrectAnswers,
              status: dto.status ?? existing.status,
              deletedAt: null,
            },
          })
        : await tx.quiz.create({
            data: {
              lessonId,
              title: dto.title?.trim() || 'Assessment',
              passingScore: dto.passingScore ?? 80,
              questionCount: dto.questions.length,
              maxAttempts: dto.maxAttempts ?? 3,
              shuffleQuestions: dto.shuffleQuestions ?? false,
              showCorrectAnswers: dto.showCorrectAnswers ?? false,
              status: dto.status ?? QuizStatus.DRAFT,
            },
          });

      await tx.quizOption.deleteMany({
        where: { question: { quizId: saved.id } },
      });
      await tx.quizQuestion.deleteMany({ where: { quizId: saved.id } });

      for (const [index, question] of dto.questions.entries()) {
        await tx.quizQuestion.create({
          data: {
            quizId: saved.id,
            prompt: question.prompt.trim(),
            explanation: question.explanation?.trim() || null,
            points: question.points ?? 1,
            sortOrder: index,
            options: {
              create: question.options.map((opt, optIndex) => ({
                label: opt.label.trim(),
                isCorrect: opt.isCorrect,
                sortOrder: optIndex,
              })),
            },
          },
        });
      }

      return tx.quiz.findUniqueOrThrow({
        where: { id: saved.id },
        include: adminQuizInclude,
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      action: existingAction(dto.status),
      entityType: 'Assessment',
      entityId: quiz.id,
      metadata: { lessonId, questions: dto.questions.length },
      ...meta,
    });
    return quiz;
  }

  async createForLevel(
    levelId: string,
    dto: CreateAssessmentDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const level = await this.requireFinalLevel(levelId);
    const existing = await this.prisma.quiz.findFirst({
      where: { levelId: level.id, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('This level already has a final assessment.');
    }

    const quiz = await this.prisma.quiz.create({
      data: {
        levelId: level.id,
        title: dto.title?.trim() || 'Final assessment',
        passingScore: dto.passingScore ?? 80,
        maxAttempts: dto.maxAttempts ?? 3,
        showCorrectAnswers: dto.showCorrectAnswers ?? false,
        shuffleQuestions: false,
        questionCount: 0,
        status: QuizStatus.DRAFT,
      },
      include: adminQuizInclude,
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSESSMENT_CREATED,
      entityType: 'Assessment',
      entityId: quiz.id,
      metadata: { levelId },
      ...meta,
    });
    return quiz;
  }

  async upsertForLevel(
    levelId: string,
    dto: UpsertQuizDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireFinalLevel(levelId);
    this.assertQuestionsValid(dto.questions);
    if (dto.status === QuizStatus.PUBLISHED) {
      this.assertPublishable({
        title: dto.title,
        passingScore: dto.passingScore ?? 80,
        maxAttempts: dto.maxAttempts ?? 3,
        questions: dto.questions,
      });
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quiz.findUnique({ where: { levelId } });
      const saved = existing
        ? await tx.quiz.update({
            where: { id: existing.id },
            data: {
              title: dto.title?.trim() || existing.title,
              passingScore: dto.passingScore ?? existing.passingScore,
              questionCount: dto.questions.length,
              maxAttempts: dto.maxAttempts ?? existing.maxAttempts,
              shuffleQuestions: dto.shuffleQuestions ?? false,
              showCorrectAnswers:
                dto.showCorrectAnswers ?? existing.showCorrectAnswers,
              status: dto.status ?? existing.status,
              deletedAt: null,
              lessonId: null,
              levelId,
            },
          })
        : await tx.quiz.create({
            data: {
              levelId,
              title: dto.title?.trim() || 'Final assessment',
              passingScore: dto.passingScore ?? 80,
              questionCount: dto.questions.length,
              maxAttempts: dto.maxAttempts ?? 3,
              shuffleQuestions: dto.shuffleQuestions ?? false,
              showCorrectAnswers: dto.showCorrectAnswers ?? false,
              status: dto.status ?? QuizStatus.DRAFT,
            },
          });

      await tx.quizOption.deleteMany({
        where: { question: { quizId: saved.id } },
      });
      await tx.quizQuestion.deleteMany({ where: { quizId: saved.id } });

      for (const [index, question] of dto.questions.entries()) {
        await tx.quizQuestion.create({
          data: {
            quizId: saved.id,
            prompt: question.prompt.trim(),
            explanation: question.explanation?.trim() || null,
            points: question.points ?? 1,
            sortOrder: index,
            options: {
              create: question.options.map((opt, optIndex) => ({
                label: opt.label.trim(),
                isCorrect: opt.isCorrect,
                sortOrder: optIndex,
              })),
            },
          },
        });
      }

      return tx.quiz.findUniqueOrThrow({
        where: { id: saved.id },
        include: adminQuizInclude,
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      action: existingAction(dto.status),
      entityType: 'Assessment',
      entityId: quiz.id,
      metadata: { levelId, questions: dto.questions.length },
      ...meta,
    });
    return quiz;
  }

  async getAdminQuiz(lessonId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId, deletedAt: null },
      include: adminQuizInclude,
    });
    if (!quiz) throw new NotFoundException('Assessment not found for lesson');
    return quiz;
  }

  async getAdminQuizByLevel(levelId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { levelId, deletedAt: null },
      include: adminQuizInclude,
    });
    if (!quiz) throw new NotFoundException('Final assessment not found for level');
    return quiz;
  }

  async getById(assessmentId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: assessmentId, deletedAt: null },
      include: adminQuizInclude,
    });
    if (!quiz) throw new NotFoundException('Assessment not found');
    return quiz;
  }

  async updateAssessment(
    assessmentId: string,
    dto: UpdateAssessmentDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const quiz = await this.getById(assessmentId);
    if (dto.status === QuizStatus.PUBLISHED) {
      this.assertPublishable({
        title: dto.title ?? quiz.title,
        passingScore: dto.passingScore ?? quiz.passingScore,
        maxAttempts: dto.maxAttempts ?? quiz.maxAttempts,
        questions: quiz.questions.map((question) => ({
          prompt: question.prompt,
          options: question.options,
        })),
      });
    }

    const updated = await this.prisma.quiz.update({
      where: { id: quiz.id },
      data: {
        title: dto.title?.trim(),
        passingScore: dto.passingScore,
        maxAttempts: dto.maxAttempts,
        showCorrectAnswers: dto.showCorrectAnswers,
        status: dto.status,
      },
      include: adminQuizInclude,
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: quiz.id,
      ...meta,
    });
    return updated;
  }

  async deleteAssessment(
    assessmentId: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const quiz = await this.getById(assessmentId);
    await this.prisma.quiz.update({
      where: { id: quiz.id },
      data: { deletedAt: new Date(), status: QuizStatus.DRAFT },
    });
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSESSMENT_DELETED,
      entityType: 'Assessment',
      entityId: quiz.id,
      metadata: { lessonId: quiz.lessonId },
      ...meta,
    });
    return { id: quiz.id, deleted: true };
  }

  async createQuestion(
    assessmentId: string,
    dto: QuizQuestionInputDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const quiz = await this.getById(assessmentId);
    const error = validateMcqQuestion(dto);
    if (error) throw new BadRequestException(error);
    const max = await this.prisma.quizQuestion.aggregate({
      where: { quizId: quiz.id, deletedAt: null },
      _max: { sortOrder: true },
    });
    const question = await this.prisma.quizQuestion.create({
      data: {
        quizId: quiz.id,
        prompt: dto.prompt.trim(),
        explanation: dto.explanation?.trim() || null,
        points: dto.points ?? 1,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        options: {
          create: dto.options.map((opt, index) => ({
            label: opt.label.trim(),
            isCorrect: opt.isCorrect,
            sortOrder: index,
          })),
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    await this.syncQuestionCount(quiz.id);
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.QUESTION_CREATED,
      entityType: 'AssessmentQuestion',
      entityId: question.id,
      metadata: { assessmentId: quiz.id },
      ...meta,
    });
    return question;
  }

  async updateQuestion(
    assessmentId: string,
    questionId: string,
    dto: QuizQuestionInputDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireQuestion(assessmentId, questionId);
    const error = validateMcqQuestion(dto);
    if (error) throw new BadRequestException(error);

    await this.prisma.$transaction(async (tx) => {
      await tx.quizOption.deleteMany({ where: { questionId } });
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: {
          prompt: dto.prompt.trim(),
          explanation: dto.explanation?.trim() || null,
          points: dto.points ?? 1,
          options: {
            create: dto.options.map((opt, index) => ({
              label: opt.label.trim(),
              isCorrect: opt.isCorrect,
              sortOrder: index,
            })),
          },
        },
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.QUESTION_UPDATED,
      entityType: 'AssessmentQuestion',
      entityId: questionId,
      metadata: { assessmentId },
      ...meta,
    });
    return this.requireQuestion(assessmentId, questionId);
  }

  async deleteQuestion(
    assessmentId: string,
    questionId: string,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    await this.requireQuestion(assessmentId, questionId);
    await this.prisma.quizQuestion.update({
      where: { id: questionId },
      data: { deletedAt: new Date() },
    });
    await this.syncQuestionCount(assessmentId);
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.QUESTION_DELETED,
      entityType: 'AssessmentQuestion',
      entityId: questionId,
      metadata: { assessmentId },
      ...meta,
    });
    return { id: questionId, deleted: true };
  }

  async reorderQuestions(
    assessmentId: string,
    dto: ReorderDto,
    actor: AuthenticatedUser,
    meta?: ClientMeta,
  ) {
    const quiz = await this.getById(assessmentId);
    const ids = new Set(quiz.questions.map((question) => question.id));
    if (dto.items.length !== quiz.questions.length || dto.items.some((item) => !ids.has(item.id))) {
      throw new BadRequestException('Reorder payload must include all questions.');
    }
    await this.prisma.$transaction(
      dto.items.map((item, index) =>
        this.prisma.quizQuestion.update({
          where: { id: item.id },
          data: { sortOrder: index },
        }),
      ),
    );
    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.ASSESSMENT_UPDATED,
      entityType: 'Assessment',
      entityId: assessmentId,
      metadata: { reorder: true },
      ...meta,
    });
    return this.getById(assessmentId);
  }

  async getLearnerAssessment(lessonId: string, user: AuthenticatedUser) {
    const assignment = await this.requireEnrollmentForLesson(lessonId, user);
    await this.sequentialAccess.assertAssessmentAccessible(
      assignment.id,
      assignment.courseId,
      lessonId,
    );
    const quiz = await this.requirePublishedQuiz(lessonId);
    const attempts = await this.listAttempts(assignment.id, lessonId, user.userId);
    return {
      assignmentId: assignment.id,
      assessment: this.toLearnerSummary(quiz, attempts),
    };
  }

  async startAttempt(
    lessonId: string,
    assignmentId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertOwnsAssignment(assignmentId, user.userId);
    const assignment = await this.prisma.courseAssignment.findFirstOrThrow({
      where: { id: assignmentId, deletedAt: null },
    });
    await this.sequentialAccess.assertAssessmentAccessible(
      assignmentId,
      assignment.courseId,
      lessonId,
    );
    await this.assertLessonCompleted(assignmentId, lessonId, user.userId);

    const quiz = await this.requirePublishedQuiz(lessonId);
    const prior = await this.prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, assignmentId },
      orderBy: { attemptNumber: 'asc' },
    });
    if (prior.some((row) => row.passed)) {
      throw new BadRequestException('Assessment already passed.');
    }
    if (prior.length >= quiz.maxAttempts) {
      throw new ForbiddenException('Maximum assessment attempts reached.');
    }

    const open = prior.find((row) => !row.submittedAt);
    if (open) {
      return this.toLearnerAttemptView(open.id, quiz.id);
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        assignmentId,
        userId: user.userId,
        attemptNumber: prior.length + 1,
      },
    });

    await this.audit.write({
      actorId: user.userId,
      action: AuditActions.ASSESSMENT_STARTED,
      entityType: 'AssessmentAttempt',
      entityId: attempt.id,
      metadata: { lessonId, attemptNumber: attempt.attemptNumber },
    });

    return this.toLearnerAttemptView(attempt.id, quiz.id);
  }

  async startLearnerAttempt(lessonId: string, user: AuthenticatedUser) {
    const assignment = await this.requireEnrollmentForLesson(lessonId, user);
    return this.startAttempt(lessonId, assignment.id, user);
  }

  async submitAttempt(
    attemptId: string,
    dto: SubmitQuizDto,
    user: AuthenticatedUser,
  ) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: true },
    });
    if (!attempt || attempt.userId !== user.userId) {
      throw new ForbiddenException('Attempt not found');
    }
    if (attempt.submittedAt) {
      throw new BadRequestException('Attempt already submitted');
    }

    if (attempt.quiz.levelId) {
      await this.programProgress.assertFinalAssessmentAccessible(
        attempt.enrollmentId,
        user.userId,
      );
    } else {
      if (!attempt.assignmentId || !attempt.quiz.lessonId) {
        throw new BadRequestException('Invalid assessment attempt.');
      }
      await this.sequentialAccess.assertAssessmentAccessible(
        attempt.assignmentId,
        (
          await this.prisma.courseAssignment.findFirstOrThrow({
            where: { id: attempt.assignmentId },
          })
        ).courseId,
        attempt.quiz.lessonId,
      );
    }

    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: attempt.quizId, deletedAt: null },
      include: { options: true },
    });
    if (dto.answers.length !== questions.length) {
      throw new BadRequestException('Submit an answer for every question.');
    }
    const seen = new Set<string>();
    for (const answer of dto.answers) {
      if (seen.has(answer.questionId)) {
        throw new BadRequestException('Duplicate answers are not allowed.');
      }
      seen.add(answer.questionId);
    }

    const questionMap = new Map(questions.map((question) => [question.id, question]));
    let earned = 0;
    let total = 0;
    let correctCount = 0;
    const answerCreates: Prisma.QuizAttemptAnswerCreateManyInput[] = [];

    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(`Invalid question ${answer.questionId}`);
      }
      const option = question.options.find((item) => item.id === answer.optionId);
      if (!option) {
        throw new BadRequestException(`Invalid option ${answer.optionId}`);
      }
      total += question.points;
      const isCorrect = option.isCorrect;
      if (isCorrect) {
        earned += question.points;
        correctCount += 1;
      }
      answerCreates.push({
        attemptId,
        questionId: question.id,
        optionId: option.id,
        isCorrect,
      });
    }

    const score = scorePercent(earned, total);
    const passed = isAssessmentPassing(score, attempt.quiz.passingScore);

    const submitted = await this.prisma.$transaction(async (tx) => {
      await tx.quizAttemptAnswer.createMany({ data: answerCreates });
      return tx.quizAttempt.update({
        where: { id: attemptId },
        data: { score, passed, submittedAt: new Date() },
      });
    });

    await this.audit.write({
      actorId: user.userId,
      action: AuditActions.ASSESSMENT_SUBMITTED,
      entityType: 'AssessmentAttempt',
      entityId: attemptId,
      metadata: { score, passed, attemptNumber: attempt.attemptNumber },
    });
    await this.audit.write({
      actorId: user.userId,
      action: passed ? AuditActions.ASSESSMENT_PASSED : AuditActions.ASSESSMENT_FAILED,
      entityType: 'AssessmentAttempt',
      entityId: attemptId,
      metadata: { score, passingScore: attempt.quiz.passingScore },
    });

    let programEvent = null;
    if (attempt.enrollmentId) {
      programEvent = await this.programProgress.syncEnrollment(attempt.enrollmentId);
    } else if (attempt.assignmentId) {
      const refreshed = await this.learning.refreshAssignmentProgress(attempt.assignmentId);
      programEvent = refreshed.programEvent ?? null;
    }

    const result = await this.toResultView(submitted.id, attempt.quiz.lessonId, user);
    return { ...result, programEvent };
  }

  async getAttemptResult(attemptId: string, user: AuthenticatedUser) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt || attempt.userId !== user.userId) {
      throw new ForbiddenException('Attempt not found');
    }
    if (!attempt.submittedAt) {
      throw new BadRequestException('Attempt has not been submitted.');
    }
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: attempt.quizId },
    });
    return this.toResultView(attemptId, quiz.lessonId, user);
  }

  async listAttempts(assignmentId: string, lessonId: string, userId: string) {
    await this.assertOwnsAssignment(assignmentId, userId);
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId, deletedAt: null },
    });
    if (!quiz) return [];
    return this.prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, assignmentId },
      orderBy: { attemptNumber: 'desc' },
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });
  }

  async listLearnerAttempts(lessonId: string, user: AuthenticatedUser) {
    const assignment = await this.requireEnrollmentForLesson(lessonId, user);
    return {
      assignmentId: assignment.id,
      attempts: await this.listAttempts(assignment.id, lessonId, user.userId),
    };
  }

  async getLearnerFinalAssessment(programId: string, user: AuthenticatedUser) {
    const enrollment = await this.requireProgramEnrollment(programId, user.userId);
    await this.programProgress.assertFinalAssessmentAccessible(enrollment.id, user.userId);
    const view = await this.programProgress.evaluate(enrollment.id);
    const finalLevel = view.levels.find((level) => level.isFinal);
    if (!finalLevel?.finalAssessment) {
      throw new NotFoundException('Final assessment is not available.');
    }
    const quiz = await this.requirePublishedQuizByLevel(finalLevel.id);
    const attempts = await this.listFinalAttempts(enrollment.id, quiz.id);
    return {
      enrollmentId: enrollment.id,
      programId,
      levelId: finalLevel.id,
      assessment: this.toLearnerSummary(quiz, attempts),
    };
  }

  async startFinalAttempt(programId: string, user: AuthenticatedUser) {
    const enrollment = await this.requireProgramEnrollment(programId, user.userId);
    await this.programProgress.assertFinalAssessmentAccessible(enrollment.id, user.userId);
    const view = await this.programProgress.evaluate(enrollment.id);
    const finalLevel = view.levels.find((level) => level.isFinal);
    if (!finalLevel?.finalAssessment) {
      throw new NotFoundException('Final assessment is not available.');
    }
    const quiz = await this.requirePublishedQuizByLevel(finalLevel.id);
    const prior = await this.prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, enrollmentId: enrollment.id },
      orderBy: { attemptNumber: 'asc' },
    });
    if (prior.some((row) => row.passed)) {
      throw new BadRequestException('Assessment already passed.');
    }
    if (prior.length >= quiz.maxAttempts) {
      throw new ForbiddenException('Maximum assessment attempts reached.');
    }
    const open = prior.find((row) => !row.submittedAt);
    if (open) {
      return this.toLearnerAttemptView(open.id, quiz.id);
    }
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        enrollmentId: enrollment.id,
        userId: user.userId,
        attemptNumber: prior.length + 1,
      },
    });
    await this.audit.write({
      actorId: user.userId,
      action: AuditActions.ASSESSMENT_STARTED,
      entityType: 'AssessmentAttempt',
      entityId: attempt.id,
      metadata: { programId, levelId: finalLevel.id, attemptNumber: attempt.attemptNumber },
    });
    return this.toLearnerAttemptView(attempt.id, quiz.id);
  }

  async listLearnerFinalAttempts(programId: string, user: AuthenticatedUser) {
    const enrollment = await this.requireProgramEnrollment(programId, user.userId);
    await this.programProgress.assertFinalAssessmentAccessible(enrollment.id, user.userId);
    const view = await this.programProgress.evaluate(enrollment.id);
    const finalLevel = view.levels.find((level) => level.isFinal);
    if (!finalLevel?.finalAssessment) {
      return { enrollmentId: enrollment.id, attempts: [] };
    }
    return {
      enrollmentId: enrollment.id,
      attempts: await this.listFinalAttempts(enrollment.id, finalLevel.finalAssessment.id),
    };
  }

  private async toResultView(
    attemptId: string,
    lessonId: string | null,
    user: AuthenticatedUser,
  ) {
    const attempt = await this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: {
        answers: true,
        quiz: {
          include: {
            questions: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
      },
    });
    if (attempt.userId !== user.userId) {
      throw new ForbiddenException('Attempt not found');
    }

    const totalQuestions = attempt.quiz.questions.length;
    const correctCount = attempt.answers.filter((row) => row.isCorrect).length;
    const used = await this.prisma.quizAttempt.count({
      where: attempt.enrollmentId
        ? { quizId: attempt.quizId, enrollmentId: attempt.enrollmentId }
        : { quizId: attempt.quizId, assignmentId: attempt.assignmentId },
    });

    return {
      id: attempt.id,
      attemptId: attempt.id,
      score: attempt.score ?? 0,
      passed: !!attempt.passed,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
      passingScore: attempt.quiz.passingScore,
      correctCount,
      incorrectCount: Math.max(0, totalQuestions - correctCount),
      totalQuestions,
      remainingAttempts: Math.max(0, attempt.quiz.maxAttempts - used),
      showCorrectAnswers: attempt.quiz.showCorrectAnswers,
      lessonId,
      title: attempt.quiz.title,
      answers: attempt.quiz.showCorrectAnswers
        ? attempt.quiz.questions.map((question) => {
            const selected = attempt.answers.find((row) => row.questionId === question.id);
            const correct = question.options.find((option) => option.isCorrect);
            return {
              questionId: question.id,
              prompt: question.prompt,
              explanation: question.explanation,
              selectedOptionId: selected?.optionId ?? null,
              correctOptionId: correct?.id ?? null,
              options: question.options.map((option) => ({
                id: option.id,
                label: option.label,
                isCorrect: option.isCorrect,
              })),
            };
          })
        : undefined,
    };
  }

  private async toLearnerAttemptView(attemptId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, label: true, sortOrder: true },
            },
          },
        },
      },
    });

    let questions = [...quiz.questions];
    if (quiz.shuffleQuestions) {
      questions = this.shuffle(questions);
    }

    const attempt = await this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });

    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      maxAttempts: quiz.maxAttempts,
      passingScore: quiz.passingScore,
      title: quiz.title,
      questions: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: quiz.shuffleQuestions ? this.shuffle(question.options) : question.options,
      })),
    };
  }

  private toLearnerSummary(
    quiz: {
      id: string;
      title: string | null;
      passingScore: number;
      maxAttempts: number;
      questionCount: number;
      questions?: unknown[];
    },
    attempts: Array<{
      id: string;
      attemptNumber: number;
      score: number | null;
      passed: boolean | null;
      submittedAt: Date | null;
    }>,
  ) {
    const submitted = attempts.filter((row) => row.submittedAt);
    const passed = submitted.some((row) => row.passed);
    const last = submitted[0] ?? null;
    const remaining = Math.max(0, quiz.maxAttempts - attempts.length);
    return {
      id: quiz.id,
      title: quiz.title,
      passingScore: quiz.passingScore,
      maxAttempts: quiz.maxAttempts,
      questionCount: quiz.questions?.length ?? quiz.questionCount,
      passed,
      lastScore: last?.score ?? null,
      attemptCount: attempts.length,
      remainingAttempts: passed ? remaining : remaining,
      lastAttemptId: last?.id ?? null,
    };
  }

  private assertQuestionsValid(questions: QuizQuestionInputDto[]) {
    for (const question of questions) {
      const error = validateMcqQuestion(question);
      if (error) throw new BadRequestException(error);
    }
  }

  private assertPublishable(input: {
    title?: string | null;
    passingScore: number;
    maxAttempts: number;
    questions: Array<{ prompt: string; options: Array<{ label: string; isCorrect: boolean }> }>;
  }) {
    const error = validateAssessmentPublish(input);
    if (error) throw new BadRequestException(error);
  }

  private async requireFinalLevel(levelId: string) {
    const level = await this.prisma.learningLevel.findFirst({
      where: { id: levelId, deletedAt: null },
    });
    if (!level) throw new NotFoundException('Level not found');
    if (!level.isFinal) {
      throw new BadRequestException('A final assessment can only be attached to the final level.');
    }
    return level;
  }

  private async requirePublishedQuizByLevel(levelId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { levelId, deletedAt: null, status: QuizStatus.PUBLISHED },
      include: adminQuizInclude,
    });
    if (!quiz) throw new NotFoundException('Final assessment is not available.');
    return quiz;
  }

  private async requireProgramEnrollment(programId: string, userId: string) {
    const enrollment = await this.prisma.programEnrollment.findFirst({
      where: { programId, userId, deletedAt: null },
    });
    if (!enrollment) {
      throw new ForbiddenException('You are not enrolled in this program.');
    }
    return enrollment;
  }

  private async listFinalAttempts(enrollmentId: string, quizId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { quizId, enrollmentId },
      orderBy: { attemptNumber: 'desc' },
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });
  }

  private async requirePdfOrVideoLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.type !== LessonType.PDF && lesson.type !== LessonType.VIDEO) {
      throw new BadRequestException('Assessments can only be attached to PDF or video lessons.');
    }
    return lesson;
  }

  private async requirePublishedQuiz(lessonId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId, deletedAt: null, status: QuizStatus.PUBLISHED },
      include: adminQuizInclude,
    });
    if (!quiz) throw new NotFoundException('Assessment not available for this lesson');
    return quiz;
  }

  private async requireQuestion(assessmentId: string, questionId: string) {
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId: assessmentId, deletedAt: null },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  private async syncQuestionCount(quizId: string) {
    const count = await this.prisma.quizQuestion.count({
      where: { quizId, deletedAt: null },
    });
    await this.prisma.quiz.update({
      where: { id: quizId },
      data: { questionCount: count },
    });
  }

  private async assertLessonCompleted(
    assignmentId: string,
    lessonId: string,
    userId: string,
  ) {
    const progress = await this.prisma.lessonProgress.findUnique({
      where: { assignmentId_lessonId: { assignmentId, lessonId } },
    });
    if (progress?.status !== LessonProgressStatus.COMPLETED) {
      throw new ForbiddenException('Complete the lesson before starting its assessment.');
    }
    if (progress.userId !== userId) {
      throw new ForbiddenException('Not your assignment');
    }
  }

  private async requireEnrollmentForLesson(lessonId: string, user: AuthenticatedUser) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      include: { module: { select: { courseId: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const assignment = await this.prisma.courseAssignment.findFirst({
      where: {
        courseId: lesson.module.courseId,
        userId: user.userId,
        deletedAt: null,
      },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not enrolled in this course.');
    }
    return assignment;
  }

  private async assertOwnsAssignment(assignmentId: string, userId: string) {
    const assignment = await this.prisma.courseAssignment.findFirst({
      where: { id: assignmentId, userId, deletedAt: null },
    });
    if (!assignment) throw new ForbiddenException('Assignment not found');
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

function existingAction(status?: QuizStatus) {
  return status === QuizStatus.PUBLISHED
    ? AuditActions.ASSESSMENT_UPDATED
    : AuditActions.ASSESSMENT_UPDATED;
}
